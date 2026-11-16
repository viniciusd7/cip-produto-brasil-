import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  conversionConfirmation, conversionMarkerId, conversionPrefix, convertDemoLocal,
  validateConversionOptions, validateConversionTarget, type ConversionOptions,
} from "./convert-demo-local";
import { parseConversionArgs } from "./convert-demo-local-cli";

const options: ConversionOptions = {
  cmdId: "original-cmd", bhId: "original-bh", userId: "original-demo",
  secretarias: { "1:CUL": "cmd-cultura" },
};

test("guardas locais, IDs explícitos, confirmação e argumentos", () => {
  for (const host of ["127.0.0.1", "localhost", "[::1]"]) {
    const url = `postgresql://${host}:55439/cip`;
    assert.equal(validateConversionTarget({
      CONVERT_DATABASE_URL: url, CONVERT_EXPECT_DATABASE: "cip",
    }).datasourceUrl, url);
  }
  for (const env of [
    {}, { DATABASE_URL: "postgresql://localhost/cip", DIRECT_URL: "postgresql://localhost/cip" },
    { CONVERT_DATABASE_URL: "postgresql://remote.example.test/cip", CONVERT_EXPECT_DATABASE: "cip" },
    { CONVERT_DATABASE_URL: "postgresql://localhost/cip?host=remote.example.test", CONVERT_EXPECT_DATABASE: "cip" },
    { CONVERT_DATABASE_URL: "postgresql://localhost/cip#x", CONVERT_EXPECT_DATABASE: "cip" },
    { CONVERT_DATABASE_URL: "mysql://localhost/cip", CONVERT_EXPECT_DATABASE: "cip" },
    { CONVERT_DATABASE_URL: "postgresql://localhost/cip", CONVERT_EXPECT_DATABASE: "outro" },
    { CONVERT_DATABASE_URL: "postgresql://localhost/cip", CONVERT_EXPECT_DATABASE: "cip", NODE_ENV: "production" },
  ]) assert.throws(() => validateConversionTarget(env));
  assert.throws(() => validateConversionOptions({ ...options, bhId: options.cmdId }));
  assert.throws(() => validateConversionOptions({ ...options, userId: "" }));
  assert.throws(() => validateConversionOptions({ ...options, secretarias: { "3:SAU": "id" } }));
  const token = conversionConfirmation("localhost:55439/cip", options);
  assert.notEqual(token, conversionConfirmation("localhost:5434/cip", options));
  assert.notEqual(token, conversionConfirmation("localhost:55439/cip", { ...options, userId: "outro" }));
  assert.notEqual(token, conversionConfirmation("localhost:55439/cip", { ...options, secretarias: {} }));
  const ids = ["--cmd-id", options.cmdId, "--bh-id", options.bhId, "--user-id", options.userId];
  assert.equal(parseConversionArgs(ids).apply, false);
  assert.equal(parseConversionArgs([...ids, "--dry-run"]).apply, false);
  for (const args of [
    [], [...ids, "--apply", "--dry-run"], [...ids, "--reset"],
    [...ids, "--cmd-id", "outro"], [...ids, "--secretarias", "null"],
    [...ids, "--secretarias", '{"1:CUL":5}'], [...ids, "--secretarias", "invalido"],
  ]) assert.throws(() => parseConversionArgs(args));
});

test("CLI ajuda não conecta e apply sem confirmação falha antes de conectar", () => {
  const invoke = (...args: string[]) => spawnSync(process.execPath, [
    "--import", "tsx", "prisma/run-convert-demo-local.ts", ...args,
  ], {
    encoding: "utf8",
    env: { ...process.env, CONVERT_DATABASE_URL: "postgresql://user:segredo-nao-exibir@127.0.0.1:1/cip",
      CONVERT_EXPECT_DATABASE: "cip", NODE_ENV: "test" },
  });
  const help = invoke("--help");
  assert.equal(help.status, 0, help.stderr);
  const invalid = invoke("--cmd-id", options.cmdId, "--bh-id", options.bhId, "--user-id", options.userId, "--apply");
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /backup confirmado/);
  assert.doesNotMatch(help.stdout + invalid.stderr, /segredo-nao-exibir/);
});

const TABLES = [
  "Municipio", "Secretaria", "SecretariaPessoa", "PlanoGoverno", "MetaEstrategica",
  "Iniciativa", "IniciativaClassificacao", "IniciativaSecretaria", "MetaExecucao",
  "MarcoEntrega", "Subtarefa", "Indicador", "Medicao", "Impedimento", "DecisaoProvidencia",
  "Evidencia", "User", "VinculoUsuarioMunicipio", "Role", "Permission", "RolePermission",
  "UserRole", "AuditLog",
] as const;

async function snapshot(db: PrismaClient) {
  const result: Record<string, Prisma.JsonObject[]> = {};
  for (const table of TABLES) {
    const rows = await db.$queryRaw<Array<{ row: Prisma.JsonObject }>>(Prisma.sql`
      SELECT to_jsonb(t) AS row FROM ${Prisma.raw(`"${table}"`)} t ORDER BY to_jsonb(t)::text
    `);
    result[table] = rows.map((r) => r.row);
  }
  return result;
}

test("conversão em PostgreSQL descartável", {
  skip: !process.env.CONVERT_TEST_DATABASE_URL && "Integração exige CONVERT_TEST_DATABASE_URL de um banco vazio cip_demo_test_*.",
}, async (t) => {
  const { datasourceUrl } = validateConversionTarget({
    CONVERT_DATABASE_URL: process.env.CONVERT_TEST_DATABASE_URL,
    CONVERT_EXPECT_DATABASE: process.env.CONVERT_TEST_CONFIRM,
    NODE_ENV: process.env.NODE_ENV,
  });
  assert.match(new URL(datasourceUrl).pathname, /^\/cip_demo_test_[a-z0-9_]+$/);
  const db = new PrismaClient({ datasourceUrl });
  try {
    assert.equal(await db.municipio.count(), 0, "Exige banco descartável vazio.");
    assert.equal(await db.user.count(), 0, "Exige banco descartável vazio.");
    await db.municipio.createMany({
      data: [
        { id: options.cmdId, nome: "Conceição do Mato Dentro", uf: "MG", ibgeCode: "3117504", cnpjOrgao: "18315416000196" },
        { id: options.bhId, nome: "Belo Horizonte", uf: "MG", ibgeCode: "3106200", prefeitoNome: "Não alterar" },
        { id: "terceiro", nome: "Município fora do escopo", uf: "MG" },
      ],
    });
    await db.secretaria.createMany({
      data: [
        { id: "cmd-edu", municipioId: options.cmdId, nome: "Educação", sigla: "EDU", titularNome: "Titular preservado" },
        { id: "cmd-cultura", municipioId: options.cmdId, nome: "Cultura", sigla: "CUL" },
        { id: "bh-unica", municipioId: options.bhId, nome: "Planejamento", sigla: "PLA" },
        ...Array.from({ length: 11 }, (_, i) => ({
          id: `cmd-outra-${i}`, municipioId: options.cmdId, nome: `Secretaria preservada ${i}`,
        })),
      ],
    });
    await db.secretariaPessoa.create({
      data: { id: "pessoa-original", secretariaId: "cmd-edu", nome: "Titular original", cargo: "Titular", papel: "TITULAR" },
    });
    await db.iniciativa.createMany({
      data: Array.from({ length: 3 }, (_, i) => ({
        id: `projeto-original-${i}`, municipioId: options.cmdId, secretariaPrincipalId: "cmd-edu",
        codigo: `ORIGINAL-${i}`, nome: `Projeto original ${i}`, descricao: "Não sobrescrever",
      })),
    });
    await db.user.createMany({
      data: [
        { id: options.userId, email: "demo-existente@example.test", name: "Usuário original", passwordHash: "hash-nao-alterar" },
        { id: "prefeito-original", email: "prefeito-original@example.test", name: "Prefeito", passwordHash: "outro-hash" },
      ],
    });
    await db.vinculoUsuarioMunicipio.createMany({
      data: [
        { id: "vinculo-demo-cmd", userId: options.userId, municipioId: options.cmdId, roleCode: "analista", principal: true },
        { id: "vinculo-demo-terceiro", userId: options.userId, municipioId: "terceiro", roleCode: "leitura", principal: false },
        { id: "vinculo-prefeito", userId: "prefeito-original", municipioId: options.cmdId, roleCode: "prefeito" },
      ],
    });
    await db.role.create({ data: { id: "role-original", code: "analista", name: "Nome editado" } });
    await db.userRole.create({ data: { roleId: "role-original", userId: options.userId } });
    const baseline = await snapshot(db);

    await t.test("dry-run usa IDs originais e não grava nenhum registro", async () => {
      const plan = await convertDemoLocal(db, options);
      assert.equal(plan.status, "planejado");
      assert.deepEqual(plan.municipios.map((m) => m.projetosAtuais), [3, 0]);
      assert.deepEqual(plan.municipios.map((m) => m.secretariasAtuais), [13, 1]);
      assert.deepEqual(plan.municipios.map((m) => m.projetosAdicionar), [4, 4]);
      assert.deepEqual(plan.vinculosAdicionar, [options.bhId]);
      assert.equal(plan.municipios[0].secretarias.find((s) => s.sigla === "CUL")?.id, "cmd-cultura");
      assert.equal(plan.municipios[0].secretarias.find((s) => s.sigla === "EDU")?.criar, false);
      assert.deepEqual(await snapshot(db), baseline);
    });

    await t.test("IDs trocados/ausentes, conta prefeito e pastas ambíguas não gravam", async () => {
      for (const bad of [
        { ...options, cmdId: options.bhId, bhId: options.cmdId },
        { ...options, cmdId: "inexistente" },
        { ...options, userId: "inexistente" },
        { ...options, userId: "prefeito-original" },
        { ...options, secretarias: {} },
        { ...options, secretarias: { "1:CUL": "bh-unica" } },
      ]) await assert.rejects(convertDemoLocal(db, bad, true));
      assert.deepEqual(await snapshot(db), baseline);
    });

    await t.test("colisão de nomes, namespace e códigos bloqueia sem sobrescrita", async () => {
      await db.municipio.create({ data: { id: "duplicata", nome: "Prefeitura Modelo 2", uf: "MG" } });
      await assert.rejects(convertDemoLocal(db, options, true), /duplicado/);
      await db.municipio.delete({ where: { id: "duplicata" } });
      await db.iniciativa.create({
        data: { id: "codigo-ocupado", municipioId: options.bhId, secretariaPrincipalId: "bh-unica",
          codigo: "DEMO-M2-EDU-01", nome: "Não alterar" },
      });
      await assert.rejects(convertDemoLocal(db, options, true), /Código de projeto/);
      await db.iniciativa.delete({ where: { id: "codigo-ocupado" } });
      await db.secretariaPessoa.create({
        data: { id: `${conversionPrefix(options.bhId)}pessoa-EDU`, secretariaId: "bh-unica", nome: "Colisão", cargo: "Não alterar" },
      });
      await assert.rejects(convertDemoLocal(db, options, true), /Namespace/);
      await db.secretariaPessoa.delete({ where: { id: `${conversionPrefix(options.bhId)}pessoa-EDU` } });
      assert.deepEqual(await snapshot(db), baseline);
    });

    await t.test("falha tardia reverte nomes, projetos, vínculos e os dois marcadores", async () => {
      await db.$executeRaw`CREATE FUNCTION conversion_test_fail() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'Falha controlada ao registrar auditoria'; END $$`;
      await db.$executeRaw`CREATE TRIGGER conversion_test_fail BEFORE INSERT ON "AuditLog"
        FOR EACH ROW EXECUTE FUNCTION conversion_test_fail()`;
      try {
        await assert.rejects(convertDemoLocal(db, options, true));
        assert.deepEqual(await snapshot(db), baseline);
      } finally {
        await db.$executeRaw`DROP TRIGGER conversion_test_fail ON "AuditLog"`;
        await db.$executeRaw`DROP FUNCTION conversion_test_fail()`;
      }
    });

    await t.test("conversão concorrente cria uma única carga e preserva todos os registros anteriores", async () => {
      const results = await Promise.all([convertDemoLocal(db, options, true), convertDemoLocal(db, options, true)]);
      assert.deepEqual(results.map((p) => p.status).sort(), ["aplicado", "ja-aplicado"]);
      assert.equal(await db.municipio.count(), 3);
      const current = await snapshot(db);
      for (const table of TABLES) {
        for (const original of baseline[table]) {
          if (table === "Municipio" && [options.cmdId, options.bhId].includes(String(original.id))) {
            const updated = current[table].find((r) => r.id === original.id)!;
            const { nome: oldName, updatedAt: oldUpdated, ...oldFields } = original;
            const { nome: newName, updatedAt: newUpdated, ...newFields } = updated;
            assert.deepEqual(newFields, oldFields);
            assert.equal(newName, original.id === options.cmdId ? "Prefeitura Modelo 1" : "Prefeitura Modelo 2");
          } else {
            assert.ok(current[table].some((row) => JSON.stringify(row) === JSON.stringify(original)), `${table} original alterado`);
          }
        }
      }
      assert.equal(await db.iniciativa.count({ where: { municipioId: options.cmdId } }), 7);
      assert.equal(await db.iniciativa.count({ where: { municipioId: options.bhId } }), 4);
      assert.equal(await db.user.count(), 2);
      const access = await db.vinculoUsuarioMunicipio.findMany({ where: { userId: options.userId } });
      assert.equal(access.length, 3);
      assert.equal(access.find((v) => v.municipioId === options.bhId)?.roleCode, "leitura");
      assert.equal(access.find((v) => v.municipioId === options.bhId)?.principal, false);
      assert.equal(access.find((v) => v.municipioId === options.cmdId)?.roleCode, "analista");
      for (const municipioId of [options.cmdId, options.bhId]) {
        const projects = await db.iniciativa.findMany({
          where: { municipioId, id: { startsWith: conversionPrefix(municipioId) } },
          include: { classificacoes: true, secretariaPrincipal: true, marcos: true, metasExecucao: true },
        });
        assert.equal(projects.length, 4);
        for (const project of projects) {
          assert.equal(project.secretariaPrincipal.municipioId, municipioId);
          assert.equal(project.marcos.length, 4);
          assert.equal(project.metasExecucao.length, 1);
          assert.ok(project.classificacoes.some((c) => c.classificacao === project.classificacaoPrincipal));
        }
        assert.equal(await db.medicao.count({ where: { municipioId } }), 12);
      }
    });

    await t.test("reexecução e dry-run preservam snapshots, nomes editados, exclusões e senhas", async () => {
      const prefix = conversionPrefix(options.cmdId);
      await db.municipio.update({ where: { id: options.cmdId }, data: { nome: "Nome editado depois" } });
      await db.iniciativa.update({ where: { id: `${prefix}projeto-0` }, data: { nome: "Exemplo editado" } });
      await db.marcoEntrega.delete({ where: { id: `${prefix}tarefa-0-0` } });
      await db.iniciativa.delete({ where: { id: `${conversionPrefix(options.bhId)}projeto-3` } });
      await db.vinculoUsuarioMunicipio.deleteMany({ where: { userId: options.userId, municipioId: options.bhId } });
      await db.user.update({ where: { id: options.userId }, data: { passwordHash: "senha-editada" } });
      const before = await snapshot(db);
      const plan = await convertDemoLocal(db, options, true);
      assert.equal(plan.status, "ja-aplicado");
      assert.match(plan.avisos.join(" "), /indisponível/);
      assert.deepEqual(plan.vinculosAdicionar, []);
      assert.equal((await convertDemoLocal(db, options)).status, "ja-aplicado");
      assert.deepEqual(await snapshot(db), before);
    });

    await t.test("trocar conta ou mapeamento municipal depois da carga é conflito", async () => {
      const before = await snapshot(db);
      await assert.rejects(convertDemoLocal(db, { ...options, userId: "prefeito-original" }, true), /mapeamento diferente/);
      await db.auditLog.update({ where: { id: conversionMarkerId(options.cmdId) }, data: { action: "MARCADOR_ALTERADO" } });
      const modified = await snapshot(db);
      await assert.rejects(convertDemoLocal(db, options, true), /Marcador parcial/);
      assert.deepEqual(await snapshot(db), modified);
      await db.auditLog.update({ where: { id: conversionMarkerId(options.cmdId) }, data: { action: "CONVERT_DEMO_LOCAL_V1" } });
      assert.deepEqual(await snapshot(db), before);
    });

    await t.test("marcador parcial não permite reconstruir exemplos excluídos", async () => {
      const marker = await db.auditLog.delete({ where: { id: conversionMarkerId(options.bhId) } });
      const before = await snapshot(db);
      await assert.rejects(convertDemoLocal(db, options, true), /Marcador parcial/);
      assert.deepEqual(await snapshot(db), before);
      await db.auditLog.create({
        data: {
          ...marker,
          before: marker.before === null ? Prisma.DbNull : marker.before,
          after: marker.after === null ? Prisma.DbNull : marker.after,
        },
      });
    });
  } finally {
    await db.$disconnect();
  }
});
