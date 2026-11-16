import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import express from "express";
import type { Prisma as PrismaTypes } from "@cip/db";
import type { RoleCode } from "@cip/shared";

// Configure antes dos imports que instanciam Prisma; nunca carregue o .env real.
process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/estrategia_tests?connect_timeout=1";
process.env.DIRECT_URL = process.env.DATABASE_URL;
const { Prisma, prisma } = require("@cip/db") as typeof import("@cip/db");
const { signAccessToken } = require("../middleware/auth") as typeof import("../middleware/auth");
const { errorHandler } = require("../middleware/error") as typeof import("../middleware/error");
const { iniciativasRouter } = require("./iniciativas") as typeof import("./iniciativas");

function stub(t: TestContext, target: object, method: string, implementation: (...args: never[]) => unknown) {
  const original = Reflect.get(target, method);
  assert.equal(typeof original, "function", method);
  Reflect.set(target, method, implementation);
  t.after(() => { Reflect.set(target, method, original); });
}

type Indicador = {
  id: string; nome: string; descricao: string | null; unidade: string | null;
  valorBase: string | null; alvo: string | null; valorAtual: string | null;
  periodicidade: string | null; municipioId: string; metaEstrategicaId: string;
  metaExecucaoId: string | null; ativo: boolean;
};
type Meta = { id: string; nome: string; descricao: string | null; planoId: string; secretariaId: string | null };
type Projeto = {
  id: string; municipioId: string; secretariaPrincipalId: string;
  metaEstrategicaId: string | null; secretarias: Array<{ secretariaId: string }>;
};
type Plano = { id: string; nome: string; periodo: string | null; municipioId: string; mandatoInicio: Date | null; mandatoFim: Date | null; createdAt: Date };

const indicadorPublico = (indicador: Indicador) => ({
  id: indicador.id, nome: indicador.nome, descricao: indicador.descricao, unidade: indicador.unidade,
  valorBase: indicador.valorBase, alvo: indicador.alvo, valorAtual: indicador.valorAtual,
  periodicidade: indicador.periodicidade,
});
const plano = (id: string, overrides: Partial<Plano> = {}): Plano => ({
  id, nome: id, periodo: null, municipioId: "municipio", mandatoInicio: null, mandatoFim: null,
  createdAt: new Date("2025-01-01"), ...overrides,
});

async function setup(t: TestContext, options: {
  role?: RoleCode; platformAdmin?: boolean; tokenRole?: RoleCode;
  secretariaId?: string | null; active?: boolean; tenant?: boolean;
  membership?: boolean;
  failAudit?: boolean; conflict?: boolean; lostLink?: boolean;
} = {}) {
  const projetos: Projeto[] = [
    { id: "projeto", municipioId: "municipio", secretariaPrincipalId: "secretaria", metaEstrategicaId: null, secretarias: [] },
    { id: "outro-projeto", municipioId: "municipio", secretariaPrincipalId: "outra", metaEstrategicaId: null, secretarias: [] },
    { id: "externo", municipioId: "outro-municipio", secretariaPrincipalId: "externa", metaEstrategicaId: null, secretarias: [] },
  ];
  const metas: Meta[] = [];
  const indicadores: Indicador[] = [];
  const planos: Plano[] = [plano("plano")];
  const auditorias: PrismaTypes.AuditLogUncheckedCreateInput[] = [];
  const transacoes: PrismaTypes.TransactionIsolationLevel[] = [];
  const role = options.role ?? "analista";
  const isPlatformAdmin = options.platformAdmin ?? role === "admin";
  const secretariaId = options.secretariaId === undefined ? "secretaria" : options.secretariaId;
  let inTransaction = false;
  let writes = 0;
  let nextMeta = 0;
  let nextIndicador = 0;

  function assertTx() { assert.equal(inTransaction, true, "Escrita fora da transacao"); writes++; }
  function findProject({ where, select }: PrismaTypes.IniciativaFindFirstArgs) {
    const projeto = projetos.find((p) => p.id === where?.id && (!where?.municipioId || p.municipioId === where.municipioId));
    if (!projeto) return null;
    if (!select?.metaEstrategica) return projeto;
    assert.deepEqual(where?.AND, [role === "gestor" ? {
      OR: [{ secretariaPrincipalId: secretariaId }, { secretarias: { some: { secretariaId } } }],
    } : {}]);
    const metaSelect = select.metaEstrategica;
    assert.equal(typeof metaSelect, "object");
    if (typeof metaSelect !== "object") throw new Error("Select ausente");
    const indicadorSelect = metaSelect.select?.indicadores;
    assert.ok(indicadorSelect && typeof indicadorSelect === "object");
    assert.deepEqual(indicadorSelect.where, { municipioId: "municipio", metaExecucaoId: null });
    assert.deepEqual(indicadorSelect.orderBy, [{ createdAt: "asc" }, { id: "asc" }]);
    const meta = metas.find((m) => m.id === projeto.metaEstrategicaId);
    return {
      ...projeto,
      metaEstrategica: meta ? {
        id: meta.id, nome: meta.nome, descricao: meta.descricao,
        plano: { municipioId: planos.find((p) => p.id === meta.planoId)?.municipioId },
        indicadores: indicadores.filter((i) =>
          i.metaEstrategicaId === meta.id && i.municipioId === "municipio" && i.metaExecucaoId === null,
        ).map(indicadorPublico),
      } : null,
    };
  }
  const tx = {
    iniciativa: {
      findFirst: async (args: PrismaTypes.IniciativaFindFirstArgs) => findProject(args),
      updateMany: async ({ where, data }: PrismaTypes.IniciativaUpdateManyArgs) => {
        assertTx();
        const projeto = projetos.find((p) =>
          p.id === where?.id && p.municipioId === where?.municipioId && p.metaEstrategicaId === where?.metaEstrategicaId,
        );
        if (!projeto || options.lostLink) return { count: 0 };
        if (typeof data.metaEstrategicaId === "string") projeto.metaEstrategicaId = data.metaEstrategicaId;
        assert.equal("classificacaoPrincipal" in data, false);
        assert.equal("vinculoPlanoGoverno" in data, false);
        return { count: 1 };
      },
      count: async ({ where }: PrismaTypes.IniciativaCountArgs) => {
        assert.equal(inTransaction, true);
        assert.equal("municipioId" in (where ?? {}), false, "Compartilhamento deve incluir todos os municipios");
        const excluded = typeof where?.id === "object" ? where.id.not : null;
        return projetos.filter((p) => p.metaEstrategicaId === where?.metaEstrategicaId && p.id !== excluded).length;
      },
    },
    planoGoverno: {
      findMany: async ({ where, orderBy, select }: PrismaTypes.PlanoGovernoFindManyArgs) => {
        assert.deepEqual(where, { municipioId: "municipio" });
        assert.deepEqual(orderBy, [{ nome: "asc" }, { id: "asc" }]);
        assert.deepEqual(select, { id: true, nome: true, periodo: true, mandatoInicio: true, mandatoFim: true });
        return planos.filter((p) => p.municipioId === where.municipioId)
          .sort((a, b) => a.nome.localeCompare(b.nome) || a.id.localeCompare(b.id))
          .map(({ id, nome, periodo, mandatoInicio, mandatoFim }) => ({ id, nome, periodo, mandatoInicio, mandatoFim }));
      },
    },
    metaEstrategica: {
      create: async ({ data }: PrismaTypes.MetaEstrategicaCreateArgs) => {
        assertTx();
        assert.ok(typeof data.planoId === "string" && typeof data.nome === "string");
        const meta: Meta = {
          id: `nova-meta-${++nextMeta}`, nome: data.nome, descricao: data.descricao ?? null,
          planoId: data.planoId, secretariaId: data.secretariaId ?? null,
        };
        metas.push(meta);
        return { id: meta.id, nome: meta.nome, descricao: meta.descricao };
      },
    },
    indicador: {
      create: async ({ data }: PrismaTypes.IndicadorCreateArgs) => {
        assertTx();
        assert.ok(typeof data.municipioId === "string" && typeof data.metaEstrategicaId === "string");
        assert.equal("metaExecucaoId" in data, false);
        const indicador: Indicador = {
          id: `novo-indicador-${++nextIndicador}`, nome: data.nome, descricao: data.descricao ?? null,
          unidade: data.unidade ?? null, valorBase: data.valorBase ?? null, alvo: data.alvo ?? null,
          valorAtual: data.valorAtual ?? null, periodicidade: data.periodicidade ?? null,
          municipioId: data.municipioId, metaEstrategicaId: data.metaEstrategicaId, metaExecucaoId: null, ativo: true,
        };
        indicadores.push(indicador);
        return indicadorPublico(indicador);
      },
    },
    auditLog: {
      create: async ({ data }: PrismaTypes.AuditLogCreateArgs) => {
        assertTx();
        if (options.failAudit) throw new Error("Falha simulada de auditoria");
        auditorias.push(data);
        return {};
      },
    },
  };
  stub(t, prisma.user, "findUnique", async () => ({ active: options.active ?? true, isPlatformAdmin }));
  stub(t, prisma.municipio, "findFirst", async () => options.tenant === false ? null : ({ id: "municipio", nome: "Municipio" }));
  stub(t, prisma.vinculoUsuarioMunicipio, "findUnique", async () =>
    options.membership === false ? null : ({ roleCode: role, secretariaId }));
  stub(t, prisma.iniciativa, "findFirst", async (args: PrismaTypes.IniciativaFindFirstArgs) => findProject(args));
  stub(t, prisma.planoGoverno, "findMany", tx.planoGoverno.findMany);
  stub(t, prisma.auditLog, "create", async ({ data }: { data: PrismaTypes.AuditLogUncheckedCreateInput }) => {
    assert.equal(data.action, "ACCESS_DENIED_CROSS_MUNICIPIO", "Auditoria de escrita deve usar tx");
    auditorias.push(data);
    return {};
  });
  for (const [delegate, methods] of [
    [prisma.metaExecucao, ["create", "deleteMany"]],
    [prisma.metaEstrategica, ["create", "update", "deleteMany"]],
    [prisma.indicador, ["create", "update", "deleteMany"]],
    [prisma.planoGoverno, ["create", "deleteMany"]],
    [prisma.iniciativa, ["update", "updateMany", "deleteMany"]],
  ] as const) {
    for (const method of methods) stub(t, delegate, method, () => { throw new Error(`Escrita global proibida: ${method}`); });
  }
  // Serializa o fake para verificar duas chamadas HTTP; P2034 e CAS são exercitados separadamente.
  let queue = Promise.resolve();
  stub(t, prisma, "$transaction", (run: (client: typeof tx) => Promise<unknown>, opts: { isolationLevel: PrismaTypes.TransactionIsolationLevel }) => {
    const result = queue.then(async () => {
      assert.equal(opts.isolationLevel, "Serializable");
      transacoes.push(opts.isolationLevel);
      const snapshot = structuredClone({ projetos, metas, indicadores, auditorias });
      inTransaction = true;
      try {
        const value = await run(tx);
        if (options.conflict) throw new Prisma.PrismaClientKnownRequestError("Conflito", { code: "P2034", clientVersion: "6" });
        return value;
      } catch (error) {
        projetos.splice(0, projetos.length, ...snapshot.projetos);
        metas.splice(0, metas.length, ...snapshot.metas);
        indicadores.splice(0, indicadores.length, ...snapshot.indicadores);
        auditorias.splice(0, auditorias.length, ...snapshot.auditorias);
        throw error;
      } finally { inTransaction = false; }
    });
    queue = result.then(() => undefined, () => undefined);
    return result;
  });

  const app = express();
  app.use(express.json());
  app.use("/iniciativas", iniciativasRouter);
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeIdleConnections();
  }));
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve); server.once("error", reject);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}/iniciativas`;
  const token = signAccessToken({
    id: "usuario", email: "qa@example.invalid", name: "QA",
    municipioId: options.tenant === false ? "" : "municipio", municipioNome: "Municipio",
    role: options.tokenRole ?? role, isPlatformAdmin, permissions: [],
  });
  async function request(path = "/projeto/estrategia", body?: unknown, auth: string | null = token) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { ...(auth ? { Authorization: `Bearer ${auth}` } : {}), "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, json: await response.json() };
  }
  function seedMeta(projectId = "projeto") {
    const meta: Meta = { id: `meta-${projectId}`, nome: "Meta legada", descricao: "Preservada", planoId: "plano", secretariaId: "secretaria" };
    metas.push(meta);
    projetos.find((p) => p.id === projectId)!.metaEstrategicaId = meta.id;
    return meta;
  }
  return { request, seedMeta, projetos, metas, indicadores, planos, auditorias, transacoes, writes: () => writes };
}

const indicadorBody = {
  nome: " Atendimentos ", descricao: " Quantidade ", unidade: "pessoas", valorBase: "0",
  alvo: "100", valorAtual: "25", periodicidade: "MENSAL",
};

test("GET sem meta possui exatamente o contrato nulo e nao grava", async (t) => {
  const ctx = await setup(t);
  assert.deepEqual(await ctx.request(), { status: 200, json: { data: { meta: null } } });
  assert.equal(ctx.writes(), 0);
});

test("cadastro atomico de meta e indicador, leitura exata e auditorias transacionais", async (t) => {
  const ctx = await setup(t);
  const created = await ctx.request(undefined, { nome: " Meta nova ", descricao: " Descricao " });
  assert.deepEqual(created, {
    status: 201, json: { data: { meta: { id: "nova-meta-1", nome: "Meta nova", descricao: "Descricao", indicadores: [] } } },
  });
  assert.equal(ctx.metas[0].planoId, "plano");
  assert.equal(ctx.metas[0].secretariaId, "secretaria");
  assert.equal(ctx.projetos[0].metaEstrategicaId, "nova-meta-1");
  assert.equal(ctx.projetos[1].metaEstrategicaId, null);
  const indicator = await ctx.request("/projeto/estrategia/indicadores", indicadorBody);
  const expected = { id: "novo-indicador-1", ...indicadorBody, nome: "Atendimentos", descricao: "Quantidade" };
  assert.deepEqual(indicator, { status: 201, json: { data: expected } });
  assert.deepEqual((await ctx.request()).json, { data: { meta: { ...created.json.data.meta, indicadores: [expected] } } });
  assert.equal(ctx.indicadores[0].municipioId, "municipio");
  assert.equal(ctx.indicadores[0].metaEstrategicaId, "nova-meta-1");
  assert.deepEqual(ctx.auditorias.map((a) => [a.action, a.entity, a.entityId]), [
    ["CREATE", "MetaEstrategica", "nova-meta-1"], ["UPDATE", "Iniciativa", "projeto"], ["CREATE", "Indicador", "novo-indicador-1"],
  ]);
  for (const audit of ctx.auditorias) {
    assert.equal(audit.actorId, "usuario");
    assert.equal(audit.municipioId, "municipio");
    assert.ok(audit.ip);
  }
  assert.deepEqual(ctx.auditorias[1].before, { metaEstrategicaId: null });
  assert.deepEqual(ctx.transacoes, ["Serializable", "Serializable"]);
});

test("campos opcionais ausentes retornam null, valores textuais preservam zero", async (t) => {
  const ctx = await setup(t);
  const meta = await ctx.request(undefined, { nome: "Meta" });
  assert.equal(meta.json.data.meta.descricao, null);
  const result = await ctx.request("/projeto/estrategia/indicadores", { nome: "Indicador", valorBase: "0" });
  assert.deepEqual(result, { status: 201, json: { data: {
    id: "novo-indicador-1", nome: "Indicador", descricao: null, unidade: null,
    valorBase: "0", alvo: null, valorAtual: null, periodicidade: null,
  } } });
});

test("meta existente e seus indicadores legados nao sao substituidos", async (t) => {
  const ctx = await setup(t);
  ctx.seedMeta();
  const before = structuredClone(ctx.metas);
  const result = await ctx.request(undefined, { nome: "Outra meta" });
  assert.equal(result.status, 409);
  assert.equal(result.json.error.code, "META_ESTRATEGICA_EXISTS");
  assert.deepEqual(ctx.metas, before);
  assert.equal(ctx.writes(), 0);
});

test("indicador exige meta do proprio projeto mesmo havendo outra meta municipal", async (t) => {
  const ctx = await setup(t);
  ctx.seedMeta("outro-projeto");
  const result = await ctx.request("/projeto/estrategia/indicadores", indicadorBody);
  assert.equal(result.status, 409);
  assert.equal(result.json.error.code, "META_ESTRATEGICA_REQUIRED");
  assert.equal(ctx.writes(), 0);
});

for (const project of ["outro-projeto", "externo"]) {
  test(`meta compartilhada com ${project} bloqueia indicador sem alterar legado`, async (t) => {
    const ctx = await setup(t);
    const meta = ctx.seedMeta();
    ctx.projetos.find((p) => p.id === project)!.metaEstrategicaId = meta.id;
    const result = await ctx.request("/projeto/estrategia/indicadores", indicadorBody);
    assert.equal(result.status, 409);
    assert.equal(result.json.error.code, "META_ESTRATEGICA_SHARED");
    assert.equal(ctx.indicadores.length, 0);
    assert.equal(ctx.auditorias.length, 0);
    assert.equal((await ctx.request()).status, 200);
  });
}

test("leitura filtra indicadores de outro municipio, outro projeto e metas de execucao; preserva inativos", async (t) => {
  const ctx = await setup(t);
  const meta = ctx.seedMeta();
  ctx.indicadores.push({
    id: "legado", nome: "Indicador legado", descricao: null, unidade: null, valorBase: "0",
    alvo: "10", valorAtual: null, periodicidade: null, municipioId: "municipio",
    metaEstrategicaId: meta.id, metaExecucaoId: null, ativo: false,
  });
  const base = ctx.indicadores[0];
  ctx.indicadores.push(
    { ...base, id: "externo", municipioId: "outro-municipio" },
    { ...base, id: "outra-meta", metaEstrategicaId: "outra-meta" },
    { ...base, id: "execucao", metaExecucaoId: "execucao" },
  );
  assert.deepEqual((await ctx.request()).json, { data: { meta: {
    id: meta.id, nome: meta.nome, descricao: meta.descricao, indicadores: [indicadorPublico(base)],
  } } });
  assert.equal(ctx.indicadores.length, 4);
});

test("meta legada vinculada a plano externo nao vaza nem recebe indicador", async (t) => {
  const ctx = await setup(t);
  ctx.seedMeta();
  ctx.planos[0].municipioId = "outro-municipio";
  for (const body of [undefined, indicadorBody]) {
    const result = await ctx.request(body ? "/projeto/estrategia/indicadores" : undefined, body);
    assert.equal(result.status, 409);
    assert.equal(result.json.error.code, "INVALID_META");
    assert.equal("data" in result.json, false);
  }
  assert.equal(ctx.writes(), 0);
});

for (const route of ["", "/indicadores"]) {
  for (const role of ["prefeito", "gestor", "leitura"] as const) {
    test(`${role} nao pode escrever estrategia${route}, mesmo com token alegando admin`, async (t) => {
      const ctx = await setup(t, { role, tokenRole: "admin" });
      const result = await ctx.request(`/projeto/estrategia${route}`, { nome: "Cadastro" });
      assert.equal(result.status, 403);
      assert.equal(result.json.error.code, "FORBIDDEN");
      assert.equal(ctx.writes(), 0);
    });
  }
}

for (const role of ["analista", "admin", "prefeito", "leitura", "gestor"] as const) {
  test(`leitura autorizada para ${role}`, async (t) => {
    const ctx = await setup(t, { role });
    assert.equal((await ctx.request()).status, 200);
  });
}

test("admin central pode criar meta e indicador na prefeitura selecionada", async (t) => {
  const ctx = await setup(t, { role: "admin" });
  assert.equal((await ctx.request(undefined, { nome: "Meta admin" })).status, 201);
  assert.equal((await ctx.request("/projeto/estrategia/indicadores", indicadorBody)).status, 201);
});

test("secretario de pasta correlata pode ler; sem participacao ou sem pasta nao pode", async (t) => {
  const ctx = await setup(t, { role: "gestor", secretariaId: "correlata" });
  assert.equal((await ctx.request()).status, 403);
  ctx.projetos[0].secretarias.push({ secretariaId: "correlata" });
  assert.equal((await ctx.request()).status, 200);
});

test("secretario sem pasta nao pode ler", async (t) => {
  const ctx = await setup(t, { role: "gestor", secretariaId: null });
  assert.equal((await ctx.request()).status, 403);
});

for (const operation of ["GET", "META", "INDICADOR"]) {
  test(`${operation} bloqueia outro municipio inclusive para admin central e audita negacao`, async (t) => {
    const ctx = await setup(t, { role: "admin" });
    const result = await ctx.request(`/externo/estrategia${operation === "INDICADOR" ? "/indicadores" : ""}`,
      operation === "GET" ? undefined : { nome: "Meta" });
    assert.equal(result.status, 403);
    assert.equal(result.json.error.code, "CROSS_MUNICIPIO_BLOCKED");
    assert.equal(ctx.auditorias[0].action, "ACCESS_DENIED_CROSS_MUNICIPIO");
    assert.equal(ctx.writes(), 0);
  });
  test(`${operation} exige projeto existente`, async (t) => {
    const ctx = await setup(t);
    const result = await ctx.request(`/inexistente/estrategia${operation === "INDICADOR" ? "/indicadores" : ""}`,
      operation === "GET" ? undefined : { nome: "Meta" });
    assert.equal(result.status, 404);
    assert.equal(ctx.writes(), 0);
  });
}

test("todas as rotas exigem autenticacao valida", async (t) => {
  const ctx = await setup(t);
  for (const auth of [null, "token-invalido"]) {
    for (const [path, body] of [
      ["/projeto/estrategia", undefined], ["/projeto/estrategia", { nome: "Meta" }],
      ["/projeto/estrategia/indicadores", indicadorBody],
      ["/projeto/estrategia/planos", undefined],
    ] as const) {
      assert.equal((await ctx.request(path, body, auth)).status, 401);
    }
  }
  assert.equal(ctx.writes(), 0);
});

test("usuario inativo nao acessa", async (t) => {
  const ctx = await setup(t, { active: false });
  assert.equal((await ctx.request()).status, 401);
});

test("usuario sem vinculo municipal nao acessa mesmo com token valido", async (t) => {
  const ctx = await setup(t, { membership: false });
  assert.equal((await ctx.request()).status, 401);
  assert.equal((await ctx.request(undefined, { nome: "Meta" })).status, 401);
  assert.equal(ctx.writes(), 0);
});

test("admin central sem prefeitura selecionada recebe erro de contexto", async (t) => {
  const ctx = await setup(t, { role: "admin", tenant: false });
  assert.equal((await ctx.request()).json.error.code, "TENANT_CONTEXT_REQUIRED");
  assert.equal((await ctx.request(undefined, { nome: "Meta" })).status, 409);
});

for (const route of ["", "/indicadores"]) {
  test(`validacao estrita e limites em estrategia${route} antes de gravar`, async (t) => {
    const ctx = await setup(t);
    ctx.seedMeta();
    const invalid = [
      {}, { nome: "  " }, { nome: "ab" }, { nome: 123 }, { nome: null },
      { nome: "a".repeat(192) }, { nome: "Meta", descricao: "x".repeat(10001) },
      { nome: "Meta", descricao: null }, { nome: "Meta", metaEstrategicaId: "outra-meta" },
      { nome: "Meta", planoId: null }, { nome: "Meta", municipioId: "externo" },
      { nome: "Meta", iniciativaId: "outro-projeto" }, { nome: "Meta", metaExecucaoId: "execucao" },
      ...(route ? ["unidade", "valorBase", "alvo", "valorAtual", "periodicidade"].flatMap((field) =>
        [0, null, {}, "x".repeat(192)].map((value) => ({ nome: "Indicador", [field]: value })),
      ) : [{ nome: "Meta", indicadores: [] }]),
    ];
    for (const body of invalid) {
      const result = await ctx.request(`/projeto/estrategia${route}`, body);
      assert.equal(result.status, 400, JSON.stringify(body));
      assert.equal(result.json.error.code, "VALIDATION_ERROR");
    }
    assert.equal(ctx.writes(), 0);
    assert.equal(ctx.transacoes.length, 0);
  });
}

test("limites maximos validos de meta e indicador sao aceitos", async (t) => {
  const ctx = await setup(t);
  const body = { nome: "m".repeat(191), descricao: "d".repeat(10000) };
  assert.equal((await ctx.request(undefined, body)).status, 201);
  assert.equal((await ctx.request("/projeto/estrategia/indicadores", {
    ...body, unidade: "u".repeat(191), valorBase: "0".repeat(191), alvo: "1".repeat(191),
    valorAtual: "2".repeat(191), periodicidade: "p".repeat(191),
  })).status, 201);
});

for (const scenario of ["sem-plano", "outro-municipio"]) {
  test(`plano ${scenario} nao pode ser escolhido e nenhum plano e criado`, async (t) => {
    const ctx = await setup(t);
    ctx.planos.splice(0);
    if (scenario !== "sem-plano") ctx.planos.push(plano(scenario, {
      ...(scenario === "outro-municipio" ? { municipioId: "externo" } : {}),
    }));
    const result = await ctx.request(undefined, { nome: "Meta" });
    assert.equal(result.status, 409);
    assert.equal(result.json.error.code, "PLANO_GOVERNO_REQUIRED");
    assert.equal(ctx.writes(), 0);
    assert.equal(ctx.metas.length, 0);
  });
}

test("multiplos planos exigem selecao mesmo havendo plano mais recente ou vigente", async (t) => {
  const ctx = await setup(t);
  ctx.planos.push(
    plano("sem-datas-recente", { createdAt: new Date("2099-01-01") }),
    plano("vigente-antigo", { mandatoInicio: new Date("2000-01-01") }),
    plano("b", { mandatoInicio: new Date("2001-01-01"), createdAt: new Date("2025-01-02") }),
    plano("a", { mandatoInicio: new Date("2001-01-01"), createdAt: new Date("2025-01-02") }),
    plano("mesmo-inicio-antigo", { mandatoInicio: new Date("2001-01-01") }),
  );
  const result = await ctx.request(undefined, { nome: "Meta" });
  assert.equal(result.status, 409);
  assert.equal(result.json.error.code, "PLANO_SELECTION_REQUIRED");
  assert.equal(ctx.writes(), 0);
  assert.equal(ctx.metas.length, 0);
  assert.equal((await ctx.request(undefined, { nome: "Meta", planoId: "b" })).status, 201);
  assert.equal(ctx.metas[0].planoId, "b");
  assert.equal((ctx.auditorias[0].after as { planoId: string }).planoId, "b");
});

test("listagem expoe todos os planos municipais com ordem estavel sem escolher por datas", async (t) => {
  const ctx = await setup(t);
  ctx.planos.push(
    plano("b", { nome: "Mesmo nome", mandatoFim: new Date("2000-01-01") }),
    plano("a", { nome: "Mesmo nome", mandatoInicio: new Date("2099-01-01"), periodo: "2099–2102" }),
    plano("externo", { municipioId: "outro-municipio" }),
  );
  const result = await ctx.request("/projeto/estrategia/planos");
  assert.equal(result.status, 200);
  assert.deepEqual(result.json, { data: { selecaoObrigatoria: true, planos: [
    { id: "a", nome: "Mesmo nome", periodo: "2099–2102", mandatoInicio: "2099-01-01T00:00:00.000Z", mandatoFim: null },
    { id: "b", nome: "Mesmo nome", periodo: null, mandatoInicio: null, mandatoFim: "2000-01-01T00:00:00.000Z" },
    { id: "plano", nome: "plano", periodo: null, mandatoInicio: null, mandatoFim: null },
  ] } });
  assert.equal(ctx.writes(), 0);
});

for (const planoId of ["inexistente", "externo"]) {
  test(`selecao de plano ${planoId} nao usa fallback nem grava`, async (t) => {
    const ctx = await setup(t);
    ctx.planos.push(plano("externo", { municipioId: "outro-municipio" }));
    const result = await ctx.request(undefined, { nome: "Meta", planoId });
    assert.equal(result.status, 422);
    assert.equal(result.json.error.code, "INVALID_PLANO");
    assert.equal(ctx.writes(), 0);
  });
}

test("selecao explicita de plano historico e permitida sem inferencia de vigencia", async (t) => {
  const ctx = await setup(t);
  ctx.planos.push(plano("historico", { mandatoFim: new Date("2000-01-01") }));
  assert.equal((await ctx.request(undefined, { nome: "Meta", planoId: " historico " })).status, 201);
  assert.equal(ctx.metas[0].planoId, "historico");
});

test("plano removido apos listagem e rejeitado sem substituicao", async (t) => {
  const ctx = await setup(t);
  ctx.planos.push(plano("removido"));
  assert.equal((await ctx.request("/projeto/estrategia/planos")).json.data.planos.length, 2);
  ctx.planos.pop();
  const result = await ctx.request(undefined, { nome: "Meta", planoId: "removido" });
  assert.equal(result.json.error.code, "INVALID_PLANO");
  assert.equal(ctx.writes(), 0);
});

test("lista zero ou um plano informa selecao nao obrigatoria e nao altera GET estrategia", async (t) => {
  const ctx = await setup(t);
  assert.equal((await ctx.request("/projeto/estrategia/planos")).json.data.selecaoObrigatoria, false);
  assert.deepEqual((await ctx.request()).json, { data: { meta: null } });
  ctx.planos.splice(0);
  assert.deepEqual((await ctx.request("/projeto/estrategia/planos")).json, { data: { planos: [], selecaoObrigatoria: false } });
});

for (const role of ["analista", "admin", "prefeito", "leitura", "gestor"] as const) {
  test(`listagem de planos respeita autorizacao e escopo para ${role}`, async (t) => {
    const ctx = await setup(t, { role });
    assert.equal((await ctx.request("/projeto/estrategia/planos")).status, 200);
    assert.equal((await ctx.request("/externo/estrategia/planos")).status, 403);
    assert.equal((await ctx.request("/inexistente/estrategia/planos")).status, 404);
    if (role === "gestor") assert.equal((await ctx.request("/outro-projeto/estrategia/planos")).status, 403);
  });
}

test("plano adicionado apos GET exige nova selecao no POST", async (t) => {
  const ctx = await setup(t);
  assert.equal((await ctx.request("/projeto/estrategia/planos")).json.data.selecaoObrigatoria, false);
  ctx.planos.push(plano("adicionado"));
  const result = await ctx.request(undefined, { nome: "Meta" });
  assert.equal(result.json.error.code, "PLANO_SELECTION_REQUIRED");
  assert.equal(ctx.writes(), 0);
});

test("indicadores de projetos diferentes no mesmo municipio ficam isolados", async (t) => {
  const ctx = await setup(t);
  ctx.seedMeta();
  ctx.seedMeta("outro-projeto");
  assert.equal((await ctx.request("/projeto/estrategia/indicadores", { nome: "Indicador A" })).status, 201);
  assert.equal((await ctx.request("/outro-projeto/estrategia/indicadores", { nome: "Indicador B" })).status, 201);
  assert.deepEqual((await ctx.request()).json.data.meta.indicadores.map((i: { nome: string }) => i.nome), ["Indicador A"]);
  assert.deepEqual((await ctx.request("/outro-projeto/estrategia")).json.data.meta.indicadores.map((i: { nome: string }) => i.nome), ["Indicador B"]);
});

for (const route of ["", "/indicadores"]) {
  for (const failure of ["failAudit", "conflict", "lostLink"] as const) {
    test(`rollback em estrategia${route} por ${failure} nao deixa meta ou indicador orfao`, async (t) => {
      const ctx = await setup(t, { [failure]: true });
      if (route) ctx.seedMeta();
      const before = structuredClone({ metas: ctx.metas, projetos: ctx.projetos, indicadores: ctx.indicadores });
      if (failure === "failAudit") t.mock.method(console, "error", () => {});
      const result = await ctx.request(`/projeto/estrategia${route}`, { nome: "Cadastro" });
      assert.equal(result.status, failure === "failAudit" ? 500 : 409);
      if (failure === "conflict") assert.equal(result.json.error.code, "ESTRATEGIA_CONCURRENT_UPDATE");
      assert.deepEqual({ metas: ctx.metas, projetos: ctx.projetos, indicadores: ctx.indicadores }, before);
      assert.equal(ctx.auditorias.length, 0);
    });
  }
}

test("duas criacoes HTTP simultaneas preservam uma unica meta sem substituir vinculo", async (t) => {
  const ctx = await setup(t);
  const responses = await Promise.all([
    ctx.request(undefined, { nome: "Meta A" }), ctx.request(undefined, { nome: "Meta B" }),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
  assert.equal(ctx.metas.length, 1);
  assert.equal(ctx.projetos[0].metaEstrategicaId, ctx.metas[0].id);
  assert.equal(ctx.auditorias.length, 2);
});
