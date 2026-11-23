import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import express from "express";
import type { Prisma as PrismaTypes } from "@cip/db";

process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/integridade_tests?connect_timeout=1";
process.env.DIRECT_URL = process.env.DATABASE_URL;
const { Prisma, prisma } = require("@cip/db") as typeof import("@cip/db");
const { signAccessToken } = require("../middleware/auth") as typeof import("../middleware/auth");
const { errorHandler } = require("../middleware/error") as typeof import("../middleware/error");
const { planejamentoRouter } = require("./planejamento") as typeof import("./planejamento");
const { iniciativasRouter } = require("./iniciativas") as typeof import("./iniciativas");

function stub(t: TestContext, target: object, method: string, implementation: (...args: never[]) => unknown) {
  const original = Reflect.get(target, method);
  assert.equal(typeof original, "function", method);
  Reflect.set(target, method, implementation);
  t.after(() => { Reflect.set(target, method, original); });
}

async function setup(t: TestContext, options: {
  compartilhada?: boolean;
  indicadorOrfao?: boolean;
  conflito?: boolean;
  metaAtual?: string | null;
  outroMunicipio?: boolean;
} = {}) {
  let emTransacao = false;
  let escritas = 0;
  let decisoes = 0;
  const isolamentos: unknown[] = [];
  const projeto = {
    id: "projeto", municipioId: "municipio", secretariaPrincipalId: "secretaria",
    metaEstrategicaId: options.metaAtual === undefined ? "meta" : options.metaAtual,
    secretarias: [],
  };
  const projetos = [projeto, ...(options.compartilhada ? [{
    ...projeto, id: "outro",
    municipioId: options.outroMunicipio ? "externo" : "municipio",
  }] : []), { ...projeto, id: "destino", metaEstrategicaId: "outra-meta" }];
  const indicador = {
    id: "indicador", municipioId: "municipio", nome: "Indicador antigo",
    metaEstrategicaId: options.indicadorOrfao ? "orfa" : "meta",
    metaExecucaoId: null as string | null,
    ativo: true,
  };
  const criados: PrismaTypes.IndicadorUncheckedCreateInput[] = [];
  function escrita() {
    assert.equal(emTransacao, true, "Escrita e verificacao precisam compartilhar transacao");
    escritas++;
  }
  stub(t, prisma.user, "findUnique", async () => ({ active: true, isPlatformAdmin: true }));
  stub(t, prisma.municipio, "findFirst", async () => ({ id: "municipio", nome: "Municipio" }));
  stub(t, prisma.vinculoUsuarioMunicipio, "findUnique", async () => null);
  stub(t, prisma.auditLog, "create", async () => ({}));
  stub(t, prisma.iniciativa, "findUnique", async () => projeto);
  stub(t, prisma.iniciativa, "findUniqueOrThrow", async () => {
    assert.equal(emTransacao, true);
    return projeto;
  });
  stub(t, prisma.iniciativa, "findFirst", async ({ where }: PrismaTypes.IniciativaFindFirstArgs) => {
    assert.equal(emTransacao, true);
    assert.equal(where?.municipioId, "municipio");
    return projetos.find((p) => p.metaEstrategicaId === where?.metaEstrategicaId && p.municipioId === where?.municipioId) ?? null;
  });
  stub(t, prisma.iniciativa, "count", async ({ where }: PrismaTypes.IniciativaCountArgs) => {
    assert.equal(emTransacao, true);
    const excluded = typeof where?.id === "object" ? where.id.not : null;
    return projetos.filter((p) => p.id !== excluded && p.metaEstrategicaId === where?.metaEstrategicaId && p.municipioId === where?.municipioId).length;
  });
  stub(t, prisma.iniciativa, "update", async ({ data }: PrismaTypes.IniciativaUpdateArgs) => {
    escrita();
    if (typeof data.metaEstrategicaId === "string" || data.metaEstrategicaId === null) {
      projeto.metaEstrategicaId = data.metaEstrategicaId;
    }
    return { ...projeto, ...data };
  });
  stub(t, prisma.metaEstrategica, "findFirst", async ({ where }: PrismaTypes.MetaEstrategicaFindFirstArgs) => {
    assert.ok(where?.plano);
    return ["meta", "orfa", "outra-meta"].includes(String(where?.id))
      ? { id: where?.id, nome: "Meta antiga" } : null;
  });
  stub(t, prisma.planoGoverno, "findFirst", async ({ where }: PrismaTypes.PlanoGovernoFindFirstArgs) => where?.id === "plano" ? { id: "plano" } : null);
  stub(t, prisma.secretaria, "findFirst", async ({ where }: PrismaTypes.SecretariaFindFirstArgs) => where?.id === "secretaria" ? { id: "secretaria" } : null);
  stub(t, prisma.metaEstrategica, "create", async ({ data }: PrismaTypes.MetaEstrategicaCreateArgs) => {
    escrita();
    return { ...data, id: "nova-meta" };
  });
  stub(t, prisma.metaEstrategica, "update", async ({ data }: PrismaTypes.MetaEstrategicaUpdateArgs) => {
    escritas++;
    return { id: "orfa", nome: "Meta antiga", ...data };
  });
  stub(t, prisma.metaExecucao, "findFirst", async ({ where }: PrismaTypes.MetaExecucaoFindFirstArgs) =>
    where?.id === "execucao" ? { id: "execucao" } : null);
  stub(t, prisma.indicador, "findFirst", async () => ({ ...indicador }));
  stub(t, prisma.indicador, "findMany", async () => [{ ...indicador }]);
  stub(t, prisma.indicador, "create", async ({ data }: { data: PrismaTypes.IndicadorUncheckedCreateInput }) => {
    escrita();
    criados.push(data);
    return { ...data, id: "novo-indicador" };
  });
  stub(t, prisma.indicador, "update", async ({ data }: PrismaTypes.IndicadorUpdateArgs) => {
    escrita();
    Object.assign(indicador, data);
    return { ...indicador };
  });
  stub(t, prisma.sugestaoIA, "findFirst", async () => ({
    id: "sugestao", entidadeId: options.indicadorOrfao ? "orfa" : "meta",
    sugestao: JSON.stringify({ tipo: "INDICADOR", nome: "Novo indicador", unidade: "%", periodicidade: "MENSAL", polaridade: "MAIOR_MELHOR", fonte: "QA" }),
  }));
  stub(t, prisma.sugestaoIA, "update", async () => { escrita(); decisoes++; return {}; });
  stub(t, prisma, "$transaction", async (
    run: (tx: PrismaTypes.TransactionClient) => Promise<unknown>,
    config: { isolationLevel?: string },
  ) => {
    assert.equal(config.isolationLevel, "Serializable");
    isolamentos.push(config.isolationLevel);
    if (options.conflito) {
      throw new Prisma.PrismaClientKnownRequestError("Conflito", { code: "P2034", clientVersion: "test" });
    }
    emTransacao = true;
    try { return await run(prisma); }
    finally { emTransacao = false; }
  });

  const app = express();
  app.use(express.json());
  app.use("/planejamento", planejamentoRouter);
  app.use("/iniciativas", iniciativasRouter);
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close((err) => err ? reject(err) : resolve());
    server.closeIdleConnections();
  }));
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const token = signAccessToken({
    id: "usuario", email: "qa@example.invalid", name: "QA", municipioId: "municipio",
    municipioNome: "Municipio", role: "admin", isPlatformAdmin: true, permissions: [],
  });
  async function request(path: string, body?: object, method = "POST") {
    const response = await fetch(`${base}${path}`, {
      method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, json: await response.json() };
  }
  return { request, projeto, indicador, criados, isolamentos, escritas: () => escritas, decisoes: () => decisoes };
}

test("permite criar meta antes dos projetos e valida prefeitura e secretaria", async (t) => {
  const ctx = await setup(t);
  assert.equal((await ctx.request("/planejamento/metas", { nome: "Nova meta", planoId: "externo", secretariaId: "secretaria" })).status, 422);
  assert.equal((await ctx.request("/planejamento/metas", { nome: "Nova meta", planoId: "plano", secretariaId: "externa" })).status, 422);
  const response = await ctx.request("/planejamento/metas", { nome: "Nova meta", planoId: "plano", secretariaId: "secretaria" });
  assert.equal(response.status, 201, JSON.stringify(response.json));
  assert.equal(ctx.escritas(), 1);
});

for (const compartilhada of [false, true]) {
  test(`indicador estrategico exige projeto e preserva compartilhamento=${compartilhada}`, async (t) => {
    const ctx = await setup(t, { compartilhada });
    const response = await ctx.request("/planejamento/indicadores", { nome: "Novo indicador", metaEstrategicaId: "meta" });
    assert.equal(response.status, 201, JSON.stringify(response.json));
    assert.equal(ctx.criados[0].metaEstrategicaId, "meta");
    assert.deepEqual(ctx.isolamentos, ["Serializable"]);
  });
}

for (const metaEstrategicaId of ["orfa", "externa"]) {
  test(`indicador aceita meta municipal sem projeto e rejeita meta externa: ${metaEstrategicaId}`, async (t) => {
    const ctx = await setup(t);
    const response = await ctx.request("/planejamento/indicadores", { nome: "Novo indicador", metaEstrategicaId });
    assert.equal(response.status, metaEstrategicaId === "orfa" ? 201 : 422);
    assert.equal(ctx.escritas(), metaEstrategicaId === "orfa" ? 1 : 0);
  });
}

test("indicadores novos não aceitam meta de execucao e alvos invalidos falham", async (t) => {
  const ctx = await setup(t);
  const legado = await ctx.request("/planejamento/indicadores", { nome: "Indicador execucao", metaExecucaoId: "execucao" });
  assert.equal(legado.status, 410);
  assert.equal(legado.json.error.code, "META_EXECUCAO_DESCONTINUADA");
  assert.equal((await ctx.request("/planejamento/indicadores", { nome: "Indicador invalido", metaExecucaoId: "externa" })).status, 410);
  assert.equal((await ctx.request("/planejamento/indicadores", { nome: "Sem alvo" })).status, 422);
  assert.equal(ctx.criados.length, 0);
});

test("patch valida alvos efetivos e nao permite retirar o ultimo alvo", async (t) => {
  const ctx = await setup(t);
  for (const body of [
    { metaEstrategicaId: null },
    { metaEstrategicaId: null, metaExecucaoId: null },
  ]) {
    const response = await ctx.request("/planejamento/indicadores/indicador", body, "PATCH");
    assert.ok([409, 422].includes(response.status), JSON.stringify(response.json));
  }
  assert.equal(ctx.escritas(), 0);
  const response = await ctx.request("/planejamento/indicadores/indicador", { metaEstrategicaId: null, metaExecucaoId: "execucao" }, "PATCH");
  assert.equal(response.status, 410);
  assert.equal(ctx.indicador.metaExecucaoId, null);
});

test("leitura e edicao descritiva de registros orfaos legados permanecem", async (t) => {
  const ctx = await setup(t, { indicadorOrfao: true });
  const leitura = await ctx.request("/planejamento/indicadores", undefined, "GET");
  assert.equal(leitura.status, 200);
  assert.equal(leitura.json.data[0].metaEstrategicaId, "orfa");
  const response = await ctx.request("/planejamento/indicadores/indicador", { nome: "Nome corrigido", metaEstrategicaId: "orfa" }, "PATCH");
  assert.equal(response.status, 200);
  assert.equal(ctx.indicador.nome, "Nome corrigido");
  assert.equal((await ctx.request("/planejamento/metas/orfa", { nome: "Meta corrigida" }, "PATCH")).status, 200);
});

for (const aceitar of [false, true]) {
  test(`sugestao de indicador orfao: aceitar=${aceitar}`, async (t) => {
    const ctx = await setup(t, { indicadorOrfao: true });
    const response = await ctx.request("/planejamento/sugestoes/sugestao/decidir", { aceitar });
    assert.equal(response.status, 200);
    assert.equal(ctx.criados.length, aceitar ? 1 : 0);
    assert.equal(ctx.decisoes(), 1);
  });
}

test("sugestao de indicador com projeto continua sendo aceita", async (t) => {
  const ctx = await setup(t);
  assert.equal((await ctx.request("/planejamento/sugestoes/sugestao/decidir", { aceitar: true })).status, 200);
  assert.equal(ctx.criados.length, 1);
  assert.equal(ctx.decisoes(), 1);
});

for (const metaEstrategicaId of [null, "outra-meta"]) {
  test(`ultimo projeto nao pode abandonar meta: destino=${metaEstrategicaId}`, async (t) => {
    const ctx = await setup(t);
    const response = await ctx.request("/iniciativas/projeto", { metaEstrategicaId }, "PATCH");
    assert.equal(response.status, 409);
    assert.equal(response.json.error.code, "META_ULTIMO_PROJETO");
    assert.equal(ctx.projeto.metaEstrategicaId, "meta");
    assert.equal(ctx.escritas(), 0);
  });
  test(`meta compartilhada permite alterar um vinculo: destino=${metaEstrategicaId}`, async (t) => {
    const ctx = await setup(t, { compartilhada: true });
    assert.equal((await ctx.request("/iniciativas/projeto", { metaEstrategicaId }, "PATCH")).status, 200);
    assert.equal(ctx.projeto.metaEstrategicaId, metaEstrategicaId);
  });
}

test("vinculo inconsistente de outro municipio nao autoriza abandonar meta", async (t) => {
  const ctx = await setup(t, { compartilhada: true, outroMunicipio: true });
  assert.equal((await ctx.request("/iniciativas/projeto", { metaEstrategicaId: null }, "PATCH")).status, 409);
});

test("patch sem troca de meta continua permitido e meta orfa pode receber projeto", async (t) => {
  const ctx = await setup(t);
  assert.equal((await ctx.request("/iniciativas/projeto", { metaEstrategicaId: "meta", responsavel: "Novo responsavel" }, "PATCH")).status, 200);
  assert.equal(ctx.projeto.metaEstrategicaId, "meta");
});

test("projeto sem meta pode vincular meta existente orfa", async (t) => {
  const ctx = await setup(t, { metaAtual: null });
  assert.equal((await ctx.request("/iniciativas/projeto", { metaEstrategicaId: "orfa" }, "PATCH")).status, 200);
  assert.equal(ctx.projeto.metaEstrategicaId, "orfa");
});

test("conflito serializavel retorna 409 sem sucesso falso", async (t) => {
  const ctx = await setup(t, { conflito: true });
  const response = await ctx.request("/planejamento/indicadores", { nome: "Novo indicador", metaEstrategicaId: "meta" });
  assert.equal(response.status, 409);
  assert.equal(response.json.error.code, "ESTRATEGIA_CONCURRENT_UPDATE");
  assert.equal(ctx.escritas(), 0);
});

test("campos de plano e meta rejeitam nomes vazios após remover espaços", async (t) => {
  const ctx = await setup(t);
  for (const [path, body] of [
    ["/planejamento/planos", { nome: "   " }],
    ["/planejamento/metas", { nome: "   ", planoId: "plano", secretariaId: "secretaria" }],
    ["/planejamento/metas", { nome: " AB ", planoId: "plano", secretariaId: "secretaria" }],
  ] as const) {
    const response = await ctx.request(path, body);
    assert.equal(response.status, 400, JSON.stringify(response.json));
    assert.match(response.json.error.message, /pelo menos 3 caracteres/);
  }
  assert.equal(ctx.escritas(), 0);
});
