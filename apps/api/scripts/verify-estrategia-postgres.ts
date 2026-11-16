import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import type { PrismaClient } from "@cip/db";

const root = path.resolve(__dirname, "../../..");
const runId = randomUUID().replaceAll("-", "");
const containerName = `cip-estrategia-it-${runId}`;
const database = `estrategia_it_${runId}`;
const label = `cip.estrategia.integration=${runId}`;
const scratch = mkdtempSync(path.join(tmpdir(), "cip-estrategia-it-"));
let containerId: string | undefined;
let prisma: PrismaClient | undefined;
let server: Server | undefined;
let checks = 0;

function docker(args: string[], input?: string) {
  return execFileSync("docker", args, {
    encoding: "utf8", input, stdio: ["pipe", "pipe", "pipe"], timeout: 60000,
  }).trim();
}

function ok(message: string) {
  console.log(`OK ${++checks}: ${message}`);
}

async function main() {
  const image = docker(["image", "inspect", "postgres:16-alpine", "--format", "{{.Id}}"]);
  const before = new Set(docker(["ps", "-q", "--no-trunc"]).split("\n").filter(Boolean));
  // Sem bind mounts e sem volumes persistentes; o cluster inteiro pertence a este teste.
  containerId = docker([
    "run", "--detach", "--rm", "--pull=never", "--name", containerName, "--label", label,
    "--network", "bridge", "--publish", "127.0.0.1::5432",
    "--tmpfs", "/var/lib/postgresql/data:rw,nosuid,noexec,size=256m",
    "--env", "POSTGRES_HOST_AUTH_METHOD=trust", "--env", "POSTGRES_USER=estrategia_it",
    "--env", `POSTGRES_DB=${database}`, image,
  ]);
  assert.ok(!before.has(containerId));
  const inspect = JSON.parse(docker(["inspect", containerId]))[0];
  assert.equal(inspect.Config.Labels["cip.estrategia.integration"], runId);
  assert.equal(inspect.Mounts.some((mount: { Type: string }) => mount.Type !== "tmpfs"), false);
  const ports = inspect.NetworkSettings.Ports["5432/tcp"];
  assert.equal(ports.length, 1);
  assert.equal(ports[0].HostIp, "127.0.0.1");
  const port = Number(ports[0].HostPort);
  assert.ok(Number.isInteger(port) && port > 0);
  const url = `postgresql://estrategia_it@127.0.0.1:${port}/${database}?schema=public`;
  const parsed = new URL(url);
  assert.equal(parsed.pathname, `/${database}`);
  assert.notEqual(parsed.pathname, "/cip");
  process.env.DATABASE_URL = url;
  process.env.DIRECT_URL = url;
  process.env.NEXTAUTH_SECRET = randomUUID();
  process.env.JWT_SECRET = process.env.NEXTAUTH_SECRET;
  delete process.env.NODE_OPTIONS;
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    const probe = spawnSync("docker", [
      "exec", containerId, "pg_isready", "-h", "127.0.0.1", "-U", "estrategia_it", "-d", database,
    ], { encoding: "utf8", timeout: 5000 });
    assert.ok([0, 1, 2].includes(probe.status ?? -1), "Falha ao verificar PostgreSQL temporario");
    if (probe.status === 0) {
      ready = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.ok(ready, "PostgreSQL temporario indisponivel");
  const dbList = docker(["exec", containerId, "psql", "-U", "estrategia_it", "-d", database, "-Atc",
    "SELECT datname FROM pg_database WHERE NOT datistemplate ORDER BY datname"]);
  assert.deepEqual(dbList.split("\n"), [database, "postgres"].sort());
  ok(`PostgreSQL 16 isolado: cluster novo em tmpfs; loopback:${port}; nenhum banco cip neste cluster`);

  // Copias isoladas evitam que o CLI procure .env junto ao schema do projeto.
  cpSync(path.join(root, "packages/db/prisma/schema.prisma"), path.join(scratch, "schema.prisma"));
  cpSync(path.join(root, "packages/db/prisma/migrations"), path.join(scratch, "migrations"), { recursive: true });
  const migrationOutput = execFileSync(process.execPath, [
    require.resolve("prisma/build/index.js", { paths: [path.join(root, "packages/db")] }),
    "migrate", "deploy", "--schema", path.join(scratch, "schema.prisma"),
  ], {
    cwd: scratch, encoding: "utf8", timeout: 60000,
    env: {
      PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR,
      DATABASE_URL: url, DIRECT_URL: url,
      PRISMA_HIDE_UPDATE_MESSAGE: "1", CHECKPOINT_DISABLE: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.match(migrationOutput, /All migrations have been successfully applied/);
  ok("Migracoes existentes aplicadas exclusivamente no banco descartavel; nenhum .env carregado");

  const dbModule = require("@cip/db") as typeof import("@cip/db");
  prisma = dbModule.prisma;
  const db = prisma;
  const identity = await db.$queryRaw<Array<{ database: string; version: string }>>`
    SELECT current_database() AS database, version() AS version
  `;
  assert.equal(identity[0].database, database);
  assert.match(identity[0].version, /PostgreSQL 16/);
  assert.equal(await db.iniciativa.count(), 0);
  const migrations = await db.$queryRaw<Array<{ count: bigint }>>`
    SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
  `;
  assert.equal(Number(migrations[0].count), 3);
  ok("Prisma confirmou identidade do banco temporario, PostgreSQL 16, 3 migracoes e zero projetos iniciais");

  const municipio = await db.municipio.create({ data: { nome: "Municipio sintetico IT", uf: "MG" } });
  const externo = await db.municipio.create({ data: { nome: "Municipio externo IT", uf: "SP" } });
  const secretaria = await db.secretaria.create({ data: { municipioId: municipio.id, nome: "Secretaria IT" } });
  const secretariaExterna = await db.secretaria.create({ data: { municipioId: externo.id, nome: "Secretaria externa IT" } });
  const planoA = await db.planoGoverno.create({ data: { municipioId: municipio.id, nome: "Plano A", periodo: "2025-2028" } });
  const planoB = await db.planoGoverno.create({ data: {
    municipioId: municipio.id, nome: "Plano B", mandatoInicio: new Date("2025-01-01"), mandatoFim: new Date("2028-12-31"),
  } });
  const planoExterno = await db.planoGoverno.create({ data: { municipioId: externo.id, nome: "Plano externo" } });
  const user = await db.user.create({ data: {
    name: "Consultor IT", email: "consultor-it@example.invalid", passwordHash: "not-a-login",
    vinculos: { create: { municipioId: municipio.id, roleCode: "analista" } },
  } });
  const leitor = await db.user.create({ data: {
    name: "Leitor IT", email: "leitor-it@example.invalid", passwordHash: "not-a-login",
    vinculos: { create: { municipioId: municipio.id, roleCode: "leitura" } },
  } });
  const createProject = (codigo: string, external = false) => db.iniciativa.create({ data: {
    nome: `Projeto IT ${codigo}`, codigo, municipioId: external ? externo.id : municipio.id,
    secretariaPrincipalId: external ? secretariaExterna.id : secretaria.id,
  } });
  const projeto = await createProject("principal");
  const concorrente = await createProject("concorrencia");
  const rollback = await createProject("rollback");
  const compartilhado = await createProject("compartilhado");
  const projetoExterno = await createProject("externo", true);
  const express = (require("express") as typeof import("express"));
  const { iniciativasRouter } = require("../src/routes/iniciativas") as typeof import("../src/routes/iniciativas");
  const { signAccessToken } = require("../src/middleware/auth") as typeof import("../src/middleware/auth");
  const { errorHandler } = require("../src/middleware/error") as typeof import("../src/middleware/error");
  const app = express();
  app.use(express.json());
  app.use("/iniciativas", iniciativasRouter);
  app.use(errorHandler);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server!.once("listening", resolve); server!.once("error", reject);
  });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/iniciativas`;
  const token = (actor: typeof user) => signAccessToken({
    id: actor.id, email: actor.email, name: actor.name, municipioId: municipio.id, municipioNome: municipio.nome,
    role: "admin", isPlatformAdmin: false, permissions: [],
  });
  const consultorToken = token(user);
  const leitorToken = token(leitor);
  async function request(id: string, suffix = "", body?: object, auth: string | null = consultorToken) {
    const response = await fetch(`${base}/${id}/estrategia${suffix}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, json: await response.json() };
  }
  assert.deepEqual(await request(projeto.id), { status: 200, json: { data: { meta: null } } });
  ok("HTTP real responde GET estrategia 200 e meta null; Express e middleware de autenticacao reais");

  const listagem = await request(projeto.id, "/planos");
  assert.deepEqual(listagem, { status: 200, json: { data: {
    planos: [
      { id: planoA.id, nome: "Plano A", periodo: "2025-2028", mandatoInicio: null, mandatoFim: null },
      { id: planoB.id, nome: "Plano B", periodo: null, mandatoInicio: "2025-01-01T00:00:00.000Z", mandatoFim: "2028-12-31T00:00:00.000Z" },
    ], selecaoObrigatoria: true,
  } } });
  ok("GET planos 200: contrato exato, dois planos municipais, selecao obrigatoria, plano externo ausente");

  const semSelecao = await request(projeto.id, "", { nome: "Meta sem selecao" });
  assert.equal(semSelecao.status, 409);
  assert.equal(semSelecao.json.error.code, "PLANO_SELECTION_REQUIRED");
  assert.equal(await db.metaEstrategica.count(), 0);
  assert.equal(await db.auditLog.count(), 0);
  assert.equal((await db.iniciativa.findUniqueOrThrow({ where: { id: projeto.id } })).metaEstrategicaId, null);
  ok("POST sem planoId 409 PLANO_SELECTION_REQUIRED; SQL confirma zero metas, vinculos e auditorias");

  const invalido = await request(projeto.id, "", { nome: "Meta invalida", planoId: planoExterno.id });
  assert.equal(invalido.status, 422);
  assert.equal(invalido.json.error.code, "INVALID_PLANO");
  assert.equal(await db.metaEstrategica.count(), 0);
  ok("Plano de outro municipio retorna 422 INVALID_PLANO, sem fallback ou escrita");

  const created = await request(projeto.id, "", { nome: "Meta estrategica IT", descricao: "Persistencia real", planoId: planoB.id });
  assert.equal(created.status, 201, JSON.stringify(created.json));
  const meta = created.json.data.meta;
  const persistida = await db.metaEstrategica.findUniqueOrThrow({ where: { id: meta.id } });
  assert.equal(persistida.planoId, planoB.id);
  assert.equal(persistida.secretariaId, secretaria.id);
  assert.equal((await db.iniciativa.findUniqueOrThrow({ where: { id: projeto.id } })).metaEstrategicaId, meta.id);
  assert.equal(await db.auditLog.count(), 2);
  assert.equal(await db.metaExecucao.count(), 0);
  assert.equal(await db.planoGoverno.count(), 3);
  ok("POST meta 201: plano B escolhido, vinculo singular persistido, 2 auditorias, zero metas de execucao/planos adicionais");

  const body = { nome: "Indicador IT", descricao: "Quantidade", unidade: "pessoas", valorBase: "0", alvo: "100", valorAtual: "25", periodicidade: "MENSAL" };
  const createdIndicador = await request(projeto.id, "/indicadores", body);
  assert.equal(createdIndicador.status, 201, JSON.stringify(createdIndicador.json));
  const indicador = createdIndicador.json.data;
  assert.deepEqual(indicador, { id: indicador.id, ...body });
  const indicadorDb = await db.indicador.findUniqueOrThrow({ where: { id: indicador.id } });
  assert.equal(indicadorDb.metaEstrategicaId, meta.id);
  assert.equal(indicadorDb.municipioId, municipio.id);
  assert.equal(indicadorDb.metaExecucaoId, null);
  assert.deepEqual((await request(projeto.id)).json, { data: { meta: { ...meta, indicadores: [indicador] } } });
  const auditorias = await db.auditLog.findMany({ where: { municipioId: municipio.id }, orderBy: { createdAt: "asc" } });
  assert.equal(auditorias.length, 3);
  assert.ok(auditorias.every((audit) => audit.actorId === user.id && audit.ip === "127.0.0.1"));
  assert.deepEqual(auditorias.map((audit) => [audit.action, audit.entity]), [["CREATE", "MetaEstrategica"], ["UPDATE", "Iniciativa"], ["CREATE", "Indicador"]]);
  ok("POST indicador 201 e GET 200: contrato exato e persistencia real; 3 auditorias com autor, municipio e IP");

  const duplicate = await request(projeto.id, "", { nome: "Nao substituir", planoId: planoA.id });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.json.error.code, "META_ESTRATEGICA_EXISTS");
  assert.equal((await db.iniciativa.findUniqueOrThrow({ where: { id: projeto.id } })).metaEstrategicaId, meta.id);
  ok("Meta existente preservada: nova tentativa retorna 409, sem substituicao");

  assert.equal((await request(projeto.id, "", undefined, null)).status, 401);
  assert.equal((await request(projeto.id, "", undefined, leitorToken)).status, 200);
  assert.equal((await request(rollback.id, "", { nome: "Bloqueada", planoId: planoA.id }, leitorToken)).status, 403);
  assert.equal((await request(projetoExterno.id)).status, 403);
  assert.equal((await request(projetoExterno.id, "/planos")).status, 403);
  assert.equal((await request(projetoExterno.id, "", { nome: "Bloqueada", planoId: planoA.id })).status, 403);
  assert.equal((await request(projetoExterno.id, "/indicadores", body)).status, 403);
  assert.equal(await db.metaEstrategica.count({ where: { plano: { municipioId: externo.id } } }), 0);
  ok("Autorizacao real: 401 sem token; leitura 200/escrita 403 para leitor; GET/POST externos 403 sem impacto municipal");

  await db.iniciativa.update({ where: { id: compartilhado.id }, data: { metaEstrategicaId: meta.id } });
  const shared = await request(projeto.id, "/indicadores", { nome: "Nao compartilhar" });
  assert.equal(shared.status, 409);
  assert.equal(shared.json.error.code, "META_ESTRATEGICA_SHARED");
  assert.equal(await db.indicador.count(), 1);
  ok("Meta compartilhada retorna 409 META_ESTRATEGICA_SHARED e nao cria indicador");

  // Falhas reais do PostgreSQL comprovam rollback de meta, vinculo, indicador e auditoria.
  const psql = (sql: string) => docker(["exec", "-i", containerId!, "psql", "-v", "ON_ERROR_STOP=1", "-U", "estrategia_it", "-d", database], sql);
  psql(`
    CREATE FUNCTION it_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'it_expected_audit_failure'; END; $$;
    CREATE TRIGGER it_reject_meta_audit BEFORE INSERT ON "AuditLog"
    FOR EACH ROW WHEN (NEW.entity = 'Iniciativa' AND NEW.action = 'UPDATE')
    EXECUTE FUNCTION it_reject_audit();
  `);
  const snapshot = { metas: await db.metaEstrategica.count(), audit: await db.auditLog.count() };
  const failed = await request(rollback.id, "", { nome: "Meta rollback IT", planoId: planoA.id });
  assert.equal(failed.status, 500);
  assert.equal(await db.metaEstrategica.count(), snapshot.metas);
  assert.equal(await db.auditLog.count(), snapshot.audit);
  assert.equal((await db.iniciativa.findUniqueOrThrow({ where: { id: rollback.id } })).metaEstrategicaId, null);
  psql('DROP TRIGGER it_reject_meta_audit ON "AuditLog";');
  ok("Falha SQL induzida na segunda auditoria: HTTP 500 e rollback real da meta, vinculo e primeira auditoria");

  const rollbackMeta = await request(rollback.id, "", { nome: "Meta teste indicador rollback", planoId: planoA.id });
  assert.equal(rollbackMeta.status, 201);
  psql(`
    CREATE TRIGGER it_reject_indicator_audit BEFORE INSERT ON "AuditLog"
    FOR EACH ROW WHEN (NEW.entity = 'Indicador') EXECUTE FUNCTION it_reject_audit();
  `);
  const snapshotIndicador = {
    count: await db.indicador.count(), audit: await db.auditLog.count(),
    updated: (await db.iniciativa.findUniqueOrThrow({ where: { id: rollback.id } })).atualizadoEm,
  };
  const failedIndicador = await request(rollback.id, "/indicadores", body);
  assert.equal(failedIndicador.status, 500);
  assert.equal(await db.indicador.count(), snapshotIndicador.count);
  assert.equal(await db.auditLog.count(), snapshotIndicador.audit);
  assert.deepEqual((await db.iniciativa.findUniqueOrThrow({ where: { id: rollback.id } })).atualizadoEm, snapshotIndicador.updated);
  psql('DROP TRIGGER it_reject_indicator_audit ON "AuditLog"; DROP FUNCTION it_reject_audit();');
  ok("Falha SQL na auditoria do indicador: HTTP 500 e rollback real do indicador, timestamp e auditoria");

  const metasAntes = await db.metaEstrategica.count();
  const auditAntes = await db.auditLog.count();
  const parallel = await Promise.all([
    request(concorrente.id, "", { nome: "Meta concorrente A", planoId: planoA.id }),
    request(concorrente.id, "", { nome: "Meta concorrente B", planoId: planoB.id }),
  ]);
  assert.deepEqual(parallel.map((r) => r.status).sort(), [201, 409]);
  assert.ok(["ESTRATEGIA_CONCURRENT_UPDATE", "META_ESTRATEGICA_EXISTS"].includes(parallel.find((r) => r.status === 409)!.json.error.code));
  assert.equal(await db.metaEstrategica.count(), metasAntes + 1);
  assert.equal(await db.auditLog.count(), auditAntes + 2);
  const winner = parallel.find((r) => r.status === 201)!.json.data.meta.id;
  assert.equal((await db.iniciativa.findUniqueOrThrow({ where: { id: concorrente.id } })).metaEstrategicaId, winner);
  assert.equal(await db.metaEstrategica.count({ where: { iniciativas: { none: {} } } }), 0);
  ok(`Concorrencia HTTP real: 201 + 409 (${parallel.find((r) => r.status === 409)!.json.error.code}); apenas uma meta, 2 auditorias, nenhuma meta orfa`);

  const after = new Set(docker(["ps", "-q", "--no-trunc"]).split("\n").filter(Boolean));
  assert.ok([...before].every((id) => after.has(id)), "Um processo preexistente mudou durante o teste");
  ok("Todos os conteineres preexistentes continuam ativos; nenhuma conexao SQL com o cluster ativo foi aberta");
}

async function cleanup() {
  try {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((error) => error ? reject(error) : resolve());
        server!.closeIdleConnections();
      });
      assert.equal(server.listening, false);
    }
  } finally {
    try {
      if (prisma) await prisma.$disconnect();
    } finally {
      try {
        if (containerId) {
          const owner = docker(["inspect", "--format", '{{index .Config.Labels "cip.estrategia.integration"}}', containerId]);
          assert.equal(owner, runId, "Nao remover recurso que nao pertence a esta execucao");
          docker(["stop", "--time", "5", containerId]);
          assert.equal(docker(["ps", "-aq", "--no-trunc", "--filter", `id=${containerId}`]), "");
          assert.equal(docker(["ps", "-aq", "--filter", `label=${label}`]), "");
          console.log("CLEANUP OK: servidor HTTP encerrado, Prisma desconectado, conteiner removido e cluster tmpfs descartado");
        }
      } finally {
        assert.ok(scratch.startsWith(path.join(tmpdir(), "cip-estrategia-it-")));
        rmSync(scratch, { recursive: true });
        console.log("CLEANUP OK: apenas diretorio temporario desta execucao removido");
      }
    }
  }
}

main()
  .then(() => console.log(`PASS: ${checks} verificacoes de integracao real PostgreSQL/HTTP`))
  .catch((error: unknown) => {
    // Nao imprime objetos de processos, ambientes ou URLs de conexao.
    console.error(error instanceof Error ? `${error.name}: ${error.message}` : "Falha no teste integrado");
    process.exitCode = 1;
  })
  .finally(cleanup)
  .catch((error: unknown) => {
    console.error(error instanceof Error ? `Cleanup falhou: ${error.message}` : "Cleanup falhou");
    process.exitCode = 1;
  });
