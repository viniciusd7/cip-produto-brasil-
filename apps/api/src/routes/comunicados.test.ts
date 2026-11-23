import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import express from "express";
import { prisma } from "@cip/db";
import type { RoleCode } from "@cip/shared";
import { permissionsForRole, signAccessToken } from "../middleware/auth";
import { errorHandler } from "../middleware/error";
import { comunicadosRouter } from "./comunicados";
import { notificacoesRouter } from "./execucao";

process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/comunicacao_tests?connect_timeout=1";
process.env.DIRECT_URL = process.env.DATABASE_URL;

type Row = Record<string, any>;
function matches(row: Row, where: Row = {}): boolean {
  if (!row) return false;
  return Object.entries(where).every(([key, value]) => {
    if (value === undefined) return true;
    if (key === "AND") return (Array.isArray(value) ? value : [value]).every((v) => matches(row, v));
    if (key === "OR") return value.some((v: Row) => matches(row, v));
    const actual = row[key];
    if (value === null || typeof value !== "object" || value instanceof Date) return actual instanceof Date && value instanceof Date ? actual.getTime() === value.getTime() : actual === value;
    if ("some" in value) return Array.isArray(actual) && actual.some((r) => matches(r, value.some));
    if ("none" in value) return Array.isArray(actual) && !actual.some((r) => matches(r, value.none));
    if ("in" in value) return value.in.includes(actual);
    if ("not" in value) return actual !== null && actual !== value.not;
    if ("lt" in value) return actual < value.lt;
    if ("contains" in value) return String(actual).toLowerCase().includes(value.contains.toLowerCase());
    return matches(actual, value);
  });
}
function selectRows(rows: Row[], args: Row = {}) {
  const result = rows.filter((row) => matches(row, args.where));
  for (const order of [...(Array.isArray(args.orderBy) ? args.orderBy : args.orderBy ? [args.orderBy] : [])].reverse()) {
    const [key, direction] = Object.entries(order)[0];
    result.sort((a, b) => a[key] < b[key] ? (direction === "desc" ? 1 : -1) : a[key] > b[key] ? (direction === "desc" ? -1 : 1) : 0);
  }
  return result.slice(0, args.take ?? result.length);
}
function stub(t: TestContext, target: object, method: string, fn: (...args: any[]) => any) {
  const original = Reflect.get(target, method);
  Reflect.set(target, method, fn);
  t.after(() => Reflect.set(target, method, original));
}

async function setup(t: TestContext, role: RoleCode = "gestor") {
  let currentRole = role;
  let currentSecretaria = "saude";
  let failAudit = false;
  const users: Row[] = [
    { id: "eu", name: "Secretária", active: true, isPlatformAdmin: false, vinculos: [] },
    { id: "consultor", name: "Consultor", active: true, isPlatformAdmin: false, vinculos: [{ municipioId: "cidade", roleCode: "analista" }] },
    { id: "obras", name: "Secretário de Obras", active: true, vinculos: [{ municipioId: "cidade", roleCode: "gestor", secretariaId: "obras", secretaria: { active: true } }] },
    { id: "cultura", name: "Cultura", active: true, vinculos: [{ municipioId: "cidade", roleCode: "gestor", secretariaId: "cultura", secretaria: { active: true } }] },
    { id: "sem-pasta", name: "Sem pasta", active: true, vinculos: [{ municipioId: "cidade", roleCode: "funcionario", secretariaId: null }] },
    { id: "inativo", name: "Inativo", active: false, vinculos: [{ municipioId: "cidade", roleCode: "analista" }] },
    { id: "externo", name: "Outra prefeitura", active: true, vinculos: [{ municipioId: "outra", roleCode: "analista" }] },
    { id: "prefeito", name: "Prefeito", active: true, vinculos: [{ municipioId: "cidade", roleCode: "prefeito" }] },
  ];
  const projetos: Row[] = [
    { id: "ubs", municipioId: "cidade", nome: "UBS Norte", codigo: "UBS-01", secretariaPrincipalId: "saude", secretariaPrincipal: { nome: "Saúde" }, secretarias: [{ secretariaId: "obras" }], createdAt: new Date("2026-11-01T12:00:00Z") },
    { id: "cultural", municipioId: "cidade", nome: "Centro cultural", codigo: "CUL-01", secretariaPrincipalId: "cultura", secretariaPrincipal: { nome: "Cultura" }, secretarias: [], createdAt: new Date("2026-11-01T12:00:00Z") },
    { id: "outra-cidade", municipioId: "outra", nome: "Projeto externo", secretariaPrincipalId: "saude", secretarias: [] },
  ];
  const data = new Date("2026-11-18T12:00:00Z");
  const mensagens: Row[] = [
    { id: "c", iniciativaId: "ubs", autorId: "consultor", destinatarioId: "eu", destinoPapel: null, texto: "Mensagem recebida", tipo: "MENSAGEM", createdAt: data },
    { id: "b", iniciativaId: "ubs", autorId: "eu", destinatarioId: "consultor", destinoPapel: null, texto: "Minha resposta", tipo: "MENSAGEM", createdAt: data },
    { id: "a", iniciativaId: "ubs", autorId: "consultor", destinatarioId: "eu", destinoPapel: null, texto: "Mensagem anterior", tipo: "MENSAGEM", createdAt: data },
    { id: "privada", iniciativaId: "cultural", autorId: "consultor", destinatarioId: "eu", destinoPapel: null, texto: "Conteúdo revogado", tipo: "MENSAGEM", createdAt: data },
    { id: "fora", iniciativaId: "outra-cidade", autorId: "externo", destinatarioId: "eu", destinoPapel: null, texto: "Conteúdo de outra cidade", tipo: "MENSAGEM", createdAt: data },
  ];
  const leituras: Row[] = [];
  const avisos: Row[] = [
    { id: "z", userId: "eu", municipioId: "cidade", entidadeTipo: "MARCO", entidadeId: "tarefa", titulo: "Tarefa atribuída", texto: "Trabalho", tipo: "ATRIBUICAO", lidaEm: null, createdAt: data, link: "/iniciativas/ubs" },
    { id: "revogado", userId: "eu", municipioId: "cidade", entidadeTipo: "MARCO", entidadeId: "tarefa-cultura", texto: "Fora do escopo", lidaEm: null, createdAt: data },
    { id: "outro-tenant", userId: "eu", municipioId: "outra", entidadeTipo: "MARCO", entidadeId: "tarefa", texto: "Outra cidade", lidaEm: null, createdAt: data },
    { id: "outro-user", userId: "consultor", municipioId: "cidade", entidadeTipo: "MARCO", entidadeId: "tarefa", lidaEm: null, createdAt: data },
  ];
  const marcos = [{ id: "tarefa", iniciativa: projetos[0], concluidoEm: null }, { id: "tarefa-cultura", iniciativa: projetos[1], concluidoEm: null }];
  const audit: Row[] = [];
  const hydrate = (m: Row) => ({ ...m, iniciativa: projetos.find((p) => p.id === m.iniciativaId), autor: users.find((u) => u.id === m.autorId), destinatario: users.find((u) => u.id === m.destinatarioId), leituras: leituras.filter((l) => l.comunicadoId === m.id && l.userId === "eu") });
  stub(t, prisma.user, "findUnique", async () => users[0]);
  stub(t, prisma.user, "findMany", async (args) => selectRows(users, args));
  stub(t, prisma.user, "findFirst", async (args) => selectRows(users, args)[0] ?? null);
  stub(t, prisma.municipio, "findFirst", async () => ({ id: "cidade", nome: "Prefeitura" }));
  stub(t, prisma.vinculoUsuarioMunicipio, "findUnique", async () => ({ roleCode: currentRole, secretariaId: currentSecretaria }));
  stub(t, prisma.iniciativa, "findFirst", async (args) => selectRows(projetos, args)[0] ?? null);
  stub(t, prisma.iniciativa, "findMany", async (args) => selectRows(projetos, args).map((p) => ({ ...p, comunicados: mensagens.filter((m) => m.iniciativaId === p.id).slice(0, 1) })));
  stub(t, prisma.marcoEntrega, "findMany", async (args) => selectRows(marcos, args));
  for (const model of [prisma.subtarefa, prisma.metaEstrategica, prisma.indicador, prisma.solicitacaoValidacao]) stub(t, model, "findMany", async () => []);
  stub(t, prisma.comunicado, "findMany", async (args) => selectRows(mensagens.map(hydrate), args));
  stub(t, prisma.comunicado, "count", async (args) => selectRows(mensagens.map(hydrate), args).length);
  stub(t, prisma.comunicado, "findFirst", async (args) => selectRows(mensagens.map(hydrate), args)[0] ?? null);
  stub(t, prisma.comunicado, "findUnique", async ({ where }) => mensagens.find((m) => m.id === where.id) ?? null);
  stub(t, prisma.comunicado, "create", async ({ data: input }) => {
    if (input.id && mensagens.some((m) => m.id === input.id)) throw Object.assign(new Error("Unique constraint"), { code: "P2002" });
    const row = { ...input, id: input.id || `nova-${mensagens.length}`, createdAt: new Date(), destinoPapel: null };
    mensagens.push(row); return row;
  });
  stub(t, prisma.comunicadoLeitura, "createMany", async ({ data }) => { for (const create of data) if (!leituras.some((l) => l.comunicadoId === create.comunicadoId && l.userId === create.userId)) leituras.push({ ...create, lidoEm: new Date() }); return { count: 1 }; });
  stub(t, prisma.notificacao, "findMany", async (args) => selectRows(avisos, args));
  stub(t, prisma.notificacao, "findFirst", async (args) => selectRows(avisos, args)[0] ?? null);
  stub(t, prisma.notificacao, "count", async (args) => selectRows(avisos, args).length);
  stub(t, prisma.notificacao, "updateMany", async ({ where, data }) => { const selected = selectRows(avisos, { where }); for (const a of selected) Object.assign(a, data); return { count: selected.length }; });
  stub(t, prisma.auditLog, "create", async ({ data }) => { if (failAudit) throw new Error("Falha simulada de auditoria"); audit.push(data); return data; });
  stub(t, prisma, "$transaction", async (fn) => { const length = mensagens.length; try { return await fn(prisma); } catch (error) { mensagens.splice(length); throw error; } });
  const token = signAccessToken({ id: "eu", email: "eu@example.invalid", name: "Secretária", role, municipioId: "cidade", municipioNome: "Prefeitura", isPlatformAdmin: false, permissions: permissionsForRole(role) });
  const app = express(); app.use(express.json()); app.use("/comunicados", comunicadosRouter); app.use("/notificacoes", notificacoesRouter); app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise<void>((resolve, reject) => { server.close((err) => err ? reject(err) : resolve()); server.closeIdleConnections(); }));
  await new Promise<void>((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const request = (path: string, body?: object, auth = true) => fetch(`http://127.0.0.1:${address.port}${path}`, { method: body ? "POST" : "GET", headers: { ...(auth ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { request, mensagens, leituras, avisos, audit, marcos, setRole: (r: RoleCode) => { currentRole = r; }, setSecretaria: (s: string) => { currentSecretaria = s; }, failAudit: () => { failAudit = true; } };
}

const envio = { iniciativaId: "ubs", destinatarioId: "consultor", texto: "Podemos revisar o prazo?", envioId: "123e4567-e89b-42d3-a456-426614174000" };

test("secretário e consultor respondem sem permissão para editar projeto; envio tem auditoria e não cria aviso duplicado", async (t) => {
  const ctx = await setup(t);
  for (const role of ["gestor", "analista"] as const) {
    ctx.setRole(role);
    assert.ok(!["gestor", "funcionario"].includes(role) || !permissionsForRole(role).includes("iniciativa:write"));
    const response = await ctx.request("/comunicados", { ...envio, envioId: undefined });
    assert.equal(response.status, 201, JSON.stringify(await response.json()));
  }
  assert.equal(ctx.audit.filter((a) => a.action === "SEND_MESSAGE").length, 2);
  assert.equal(ctx.avisos.length, 4);
});

test("prefeito e leitura consultam, mas não enviam mesmo com permissão antiga no token", async (t) => {
  const ctx = await setup(t);
  for (const role of ["prefeito", "leitura"] as const) {
    ctx.setRole(role);
    assert.equal((await ctx.request("/comunicados", envio)).status, 403);
    const response = await ctx.request("/comunicados?iniciativaId=ubs");
    assert.equal(response.status, 200);
    assert.equal((await response.json()).canRespond, false);
  }
});

test("a conversa exige sessão, escopo do autor e destinatário ativo com acesso ao projeto", async (t) => {
  const ctx = await setup(t);
  assert.equal((await ctx.request("/comunicados", envio, false)).status, 401);
  for (const destinatarioId of ["cultura", "inativo", "externo", "sem-pasta", "eu"]) {
    assert.equal((await ctx.request("/comunicados", { ...envio, destinatarioId })).status, 422, destinatarioId);
  }
  assert.equal((await ctx.request("/comunicados", { ...envio, iniciativaId: "cultural" })).status, 403);
  assert.equal((await ctx.request("/comunicados", { ...envio, iniciativaId: "outra-cidade" })).status, 403);
  assert.equal((await ctx.request("/comunicados?iniciativaId=cultural")).status, 403);
  assert.equal((await ctx.request("/comunicados?iniciativaId=outra-cidade")).status, 403);
  assert.equal((await ctx.request("/comunicados/destinatarios")).status, 400);
  const response = await ctx.request("/comunicados/destinatarios?iniciativaId=ubs");
  assert.deepEqual((await response.json()).data.map((u: Row) => u.id).sort(), ["consultor", "obras", "prefeito"]);
});

test("secretaria correlata participa e pasta sem vínculo não acessa", async (t) => {
  const ctx = await setup(t);
  ctx.setSecretaria("obras");
  assert.equal((await ctx.request("/comunicados", envio)).status, 201);
  ctx.setSecretaria("cultura");
  assert.equal((await ctx.request("/comunicados", envio)).status, 403);
});

test("repetir envio não duplica mensagem; mesma chave com conteúdo diferente retorna conflito", async (t) => {
  const ctx = await setup(t);
  const [a, b] = await Promise.all([ctx.request("/comunicados", envio), ctx.request("/comunicados", envio)]);
  assert.equal(a.status, 201); assert.equal(b.status, 200);
  assert.equal(ctx.mensagens.filter((m) => m.texto === envio.texto).length, 1);
  assert.equal(ctx.audit.filter((a) => a.action === "SEND_MESSAGE").length, 1);
  assert.equal((await ctx.request("/comunicados", { ...envio, texto: "Mensagem diferente" })).status, 409);
});

test("central pagina fontes e datas empatadas sem repetir itens e conta somente entregas recebidas autorizadas", async (t) => {
  const ctx = await setup(t);
  let cursor: string | null = null;
  const chaves: string[] = [];
  do {
    const r = await ctx.request(`/comunicados/avisos?limite=1${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
    assert.equal(r.status, 200);
    const pagina = await r.json();
    assert.equal(pagina.naoLidas, 3);
    chaves.push(...pagina.data.map((n: Row) => `${n.origem}:${n.id}`));
    cursor = pagina.nextCursor;
  } while (cursor && chaves.length < 10);
  assert.deepEqual(chaves, ["notificacao:z", "comunicado:c", "comunicado:a"]);
  assert.equal((await (await ctx.request("/comunicados/resumo")).json()).naoLidas, 3);
  assert.equal((await ctx.request("/comunicados/avisos?cursor=quebrado")).status, 400);
});

test("leitura é idempotente, isolada por prefeitura e não conclui tarefa nem decisão", async (t) => {
  const ctx = await setup(t);
  for (let i = 0; i < 2; i++) assert.equal((await ctx.request("/comunicados/c/lido", {})).status, 200);
  assert.equal(ctx.leituras.length, 1);
  assert.equal((await ctx.request("/notificacoes/outro-tenant/lida", {})).status, 404);
  assert.equal((await ctx.request("/notificacoes/revogado/lida", {})).status, 404);
  assert.equal((await ctx.request("/comunicados/privada/lido", {})).status, 404);
  assert.equal((await ctx.request("/notificacoes/z/lida", {})).status, 200);
  assert.equal(ctx.avisos.find((a) => a.id === "outro-tenant")?.lidaEm, null);
  assert.equal((await (await ctx.request("/comunicados/resumo")).json()).naoLidas, 1);
  assert.equal(ctx.marcos[0].concluidoEm, null);
});

test("projetos e histórico mantêm paginação estável e acesso revogado some da central antiga e nova", async (t) => {
  const ctx = await setup(t);
  const projetos = await (await ctx.request("/comunicados/projetos")).json();
  assert.deepEqual(projetos.data.map((p: Row) => p.id), ["ubs"]);
  const first = await (await ctx.request("/comunicados?iniciativaId=ubs&limite=2")).json();
  const second = await (await ctx.request(`/comunicados?iniciativaId=ubs&limite=2&cursor=${first.nextCursor}`)).json();
  assert.deepEqual([...first.data, ...second.data].map((m: Row) => m.id), ["c", "b", "a"]);
  ctx.setSecretaria("sem-acesso");
  assert.deepEqual((await (await ctx.request("/notificacoes")).json()).data, []);
  assert.deepEqual((await (await ctx.request("/comunicados/avisos")).json()).data, []);
});

test("texto inválido não é enviado", async (t) => {
  const ctx = await setup(t);
  for (const texto of ["  ", "a", "a".repeat(5001)]) assert.equal((await ctx.request("/comunicados", { ...envio, texto })).status, 400);
});

test("falha na auditoria impede persistência parcial da mensagem", async (t) => {
  const ctx = await setup(t);
  const original = ctx.mensagens.length;
  ctx.failAudit();
  t.mock.method(console, "error", () => {});
  assert.equal((await ctx.request("/comunicados", envio)).status, 500);
  assert.equal(ctx.mensagens.length, original);
});
