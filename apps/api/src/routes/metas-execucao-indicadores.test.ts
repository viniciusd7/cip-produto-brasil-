import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import express from "express";
import { prisma, type Prisma } from "@cip/db";
import { signAccessToken } from "../middleware/auth";
import { errorHandler } from "../middleware/error";
import { iniciativasRouter } from "./iniciativas";
import { planejamentoRouter } from "./planejamento";

process.env.DATABASE_URL = "******127.0.0.1:1/metas_execucao_tests?connect_timeout=1";
process.env.DIRECT_URL = process.env.DATABASE_URL;

function stub(
  t: TestContext,
  target: object,
  method: string,
  implementation: (...args: never[]) => unknown,
) {
  const original = Reflect.get(target, method);
  assert.equal(typeof original, "function", method);
  Reflect.set(target, method, implementation);
  t.after(() => {
    Reflect.set(target, method, original);
  });
}

type TestInitiativa = {
  id: string;
  municipioId: string;
  secretariaPrincipalId: string;
  fluxoWizard: string;
  classificacaoPrincipal: string;
  estruturante: boolean;
  ciclo: string;
  metaEstrategicaId: string | null;
  secretariaPrincipal: { nome: string };
  classificacoes: Array<{ classificacao: string }>;
  metasExecucao: Array<Record<string, unknown>>;
  marcos: Array<Record<string, unknown>>;
  dataReferencia: Date | null;
  fonte: string;
  bloqueioLabel: string | null;
  bloqueiosAtivos: string[];
};

async function setup(
  t: TestContext,
  options: {
    iniciativa?: Partial<TestInitiativa>;
    metaExecucaoMunicipioId?: string;
  } = {},
) {
  const iniciativa: TestInitiativa = {
    id: "projeto",
    municipioId: "municipio",
    secretariaPrincipalId: "secretaria",
    fluxoWizard: "ESTRUTURANTE",
    classificacaoPrincipal: "ESTRUTURANTE",
    estruturante: true,
    ciclo: "EM_ACOMPANHAMENTO",
    metaEstrategicaId: null,
    secretariaPrincipal: { nome: "Secretaria" },
    classificacoes: [{ classificacao: "ESTRUTURANTE" }],
    metasExecucao: [{
      id: "meta-execucao",
      iniciativaId: "projeto",
      nome: "Entregar atendimento",
      marcos: [],
    }],
    marcos: [],
    dataReferencia: null,
    fonte: "wizard",
    bloqueioLabel: null,
    bloqueiosAtivos: [],
    ...options.iniciativa,
  };
  const metasCriadas: Array<Record<string, unknown>> = [];
  const indicadoresCriados: Array<Record<string, unknown>> = [];
  const auditLogs: Array<Record<string, unknown>> = [];
  const tarefasCriadas: Array<Record<string, unknown>> = [];
  const tarefasEditadas: Array<Record<string, unknown>> = [];

  stub(t, prisma.user, "findUnique", async () => ({ active: true, isPlatformAdmin: true }));
  stub(t, prisma.municipio, "findFirst", async () => ({ id: "municipio", nome: "Município" }));
  stub(t, prisma.vinculoUsuarioMunicipio, "findUnique", async () => null);
  stub(t, prisma.auditLog, "create", async ({ data }: { data: Record<string, unknown> }) => {
    auditLogs.push(data);
    return {};
  });
  stub(t, prisma.iniciativa, "findUnique", async (args: Record<string, unknown>) => {
    return iniciativa;
  });
  stub(t, prisma.iniciativa, "findFirst", async () => ({
    id: iniciativa.id,
    municipioId: iniciativa.municipioId,
    secretariaPrincipalId: iniciativa.secretariaPrincipalId,
    secretarias: [],
  }));
  stub(t, prisma.metaExecucao, "create", async ({ data }: { data: Record<string, unknown> }) => {
    metasCriadas.push(data);
    return { id: "meta-execucao-nova", ...data };
  });
  stub(t, prisma.marcoEntrega, "count", async ({ where }: { where: Record<string, unknown> }) => {
    assert.deepEqual(where, { iniciativaId: "projeto" });
    return 2;
  });
  stub(t, prisma.marcoEntrega, "create", async ({ data }: { data: Record<string, unknown> }) => {
    tarefasCriadas.push(data);
    return { id: "tarefa-nova", ...data };
  });
  stub(t, prisma.marcoEntrega, "findUnique", async () => ({
    id: "tarefa-legada",
    iniciativaId: "projeto",
    metaExecucaoId: "meta-execucao",
    responsavelUserId: null,
    descricao: "Tarefa antiga",
    iniciativa: { id: "projeto", municipioId: iniciativa.municipioId, codigo: "PROJ", nome: "Projeto" },
  }));
  stub(t, prisma.marcoEntrega, "update", async ({ data }: { data: Record<string, unknown> }) => {
    tarefasEditadas.push(data);
    return { id: "tarefa-legada", metaExecucaoId: "meta-execucao", descricao: "Tarefa antiga", ...data };
  });
  stub(t, prisma.metaExecucao, "findFirst", async ({ where }: {
    where: { id: string; iniciativa: { municipioId: string } };
  }) => {
    if (
      where.iniciativa.municipioId !==
        (options.metaExecucaoMunicipioId ?? "municipio") ||
      where.id !== "meta-execucao"
    ) {
      return null;
    }
    return { id: where.id };
  });
  stub(t, prisma.indicador, "create", async ({ data }: { data: Record<string, unknown> }) => {
    indicadoresCriados.push(data);
    return { id: "indicador-novo", ...data };
  });
  stub(t, prisma.solicitacaoValidacao, "findMany", async () => []);
  stub(t, prisma, "$transaction", async (
    run: (tx: Prisma.TransactionClient) => Promise<unknown>,
    config: { isolationLevel?: string },
  ) => {
    assert.equal(config.isolationLevel, "Serializable");
    return run(prisma);
  });

  const app = express();
  app.use(express.json());
  app.use("/iniciativas", iniciativasRouter);
  app.use("/planejamento", planejamentoRouter);
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
    server.closeIdleConnections();
  }));
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Servidor de teste sem endereço TCP");
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const token = signAccessToken({
    id: "usuario",
    email: "qa@example.invalid",
    name: "QA",
    municipioId: "municipio",
    municipioNome: "Município",
    role: "admin",
    isPlatformAdmin: true,
    permissions: [],
  });

  async function request(path: string, body?: object, method = body ? "POST" : "GET") {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, json: await response.json() };
  }

  return {
    request,
    iniciativa,
    metasCriadas,
    indicadoresCriados,
    auditLogs,
    tarefasCriadas,
    tarefasEditadas,
  };
}

for (const classificacao of ["ESTRUTURANTE", "PRIORITARIO"]) {
  test(`meta de execução de ${classificacao} não pode mais ser criada`, async (t) => {
    const ctx = await setup(t, {
      iniciativa: {
        fluxoWizard: classificacao,
        classificacaoPrincipal: classificacao,
        estruturante: classificacao === "ESTRUTURANTE",
        classificacoes: [{ classificacao }],
      },
    });

    const response = await ctx.request("/iniciativas/projeto/metas-execucao", {
      nome: "Entregar atendimento",
    });

    assert.equal(response.status, 410, JSON.stringify(response.json));
    assert.equal(response.json.error.code, "META_EXECUCAO_DESCONTINUADA");
    assert.equal(ctx.metasCriadas.length, 0);
    assert.equal(ctx.auditLogs.length, 0);
  });
}

test("tarefas novas pertencem diretamente ao projeto", async (t) => {
  const ctx = await setup(t);
  const response = await ctx.request("/iniciativas/projeto/marcos", { descricao: "Tarefa direta" });
  assert.equal(response.status, 201, JSON.stringify(response.json));
  assert.deepEqual(ctx.tarefasCriadas[0], {
    iniciativaId: "projeto", descricao: "Tarefa direta", codigo: undefined,
    responsavel: undefined, prazoOriginal: null, prazoVigente: null, ordem: 2, gravidade: undefined,
  });
  assert.equal("metaExecucaoId" in ctx.tarefasCriadas[0], false);
});

test("novas tarefas rejeitam vinculo de execucao em vez de ignorar o pedido", async (t) => {
  const ctx = await setup(t);
  for (const metaExecucaoId of ["meta-execucao", "", null]) {
    const response = await ctx.request("/iniciativas/projeto/marcos", {
      descricao: "Tarefa", metaExecucaoId,
    });
    assert.equal(response.status, 400, JSON.stringify(response.json));
    assert.equal(response.json.error.code, "VALIDATION_ERROR");
  }
  assert.equal(ctx.tarefasCriadas.length, 0);
});

test("edicao de projeto rejeita pedido de vinculo de execucao sem sucesso falso", async (t) => {
  const ctx = await setup(t);
  for (const body of [
    { metaExecucaoId: "meta-execucao" },
    { metasExecucao: [{ id: "meta-execucao" }] },
  ]) {
    const response = await ctx.request("/iniciativas/projeto", body, "PATCH");
    assert.equal(response.status, 400, JSON.stringify(response.json));
    assert.equal(response.json.error.code, "VALIDATION_ERROR");
  }
  assert.equal(ctx.auditLogs.length, 0);
});

test("tarefas legadas editam sem exigir meta e preservam ou removem vinculo antigo", async (t) => {
  const ctx = await setup(t);
  for (const extra of [{}, { metaExecucaoId: "meta-execucao" }, { metaExecucaoId: null }]) {
    const response = await ctx.request("/iniciativas/marcos/tarefa-legada", {
      descricao: "Tarefa atualizada", ...extra,
    }, "PATCH");
    assert.equal(response.status, 200, JSON.stringify(response.json));
  }
  assert.deepEqual(ctx.tarefasEditadas, [
    { descricao: "Tarefa atualizada" },
    { descricao: "Tarefa atualizada" },
    { descricao: "Tarefa atualizada", metaExecucaoId: null },
  ]);
  const response = await ctx.request("/iniciativas/marcos/tarefa-legada", {
    metaExecucaoId: "outra-meta",
  }, "PATCH");
  assert.equal(response.status, 422, JSON.stringify(response.json));
  assert.equal(response.json.error.code, "META_EXECUCAO_DESCONTINUADA");
  assert.equal(ctx.tarefasEditadas.length, 3);
});

test("detalhe disponibiliza todas as tarefas sem depender da lista de metas legadas", async (t) => {
  const antigas = { id: "tarefa-legada", metaExecucaoId: "meta-execucao", reprogramacoes: [], subtarefas: [] };
  const diretas = { id: "tarefa-direta", metaExecucaoId: null, reprogramacoes: [], subtarefas: [] };
  const ctx = await setup(t, { iniciativa: { metasExecucao: [], marcos: [antigas, diretas] } });
  const response = await ctx.request("/iniciativas/projeto");
  assert.equal(response.status, 200, JSON.stringify(response.json));
  assert.deepEqual(response.json.data.marcos.map((m: { id: string }) => m.id), ["tarefa-legada", "tarefa-direta"]);
  assert.equal(response.json.data.marcos[0].metaExecucaoId, "meta-execucao");
});

test("indicador novo não pode ser vinculado a meta de execução", async (t) => {
  const ctx = await setup(t);
  for (const target of [
    { metaExecucaoId: "meta-execucao" },
    { metaEstrategicaId: "meta-estrategica", metaExecucaoId: "meta-execucao" },
  ]) {
    const response = await ctx.request("/planejamento/indicadores", {
      ...target,
      nome: "Atendimentos realizados",
      valorBase: "0",
      alvo: "100",
      periodicidade: "MENSAL",
    });
    assert.equal(response.status, 410, JSON.stringify(response.json));
    assert.equal(response.json.error.code, "META_EXECUCAO_DESCONTINUADA");
  }
  assert.equal(ctx.indicadoresCriados.length, 0);
});

test("indicador legado permanece legível sem permitir novas criações", async (t) => {
  const ctx = await setup(t);
  const legado = {
    id: "indicador-legado",
    municipioId: "municipio",
    nome: "Indicador antigo",
    metaExecucaoId: "meta-execucao",
    metaEstrategicaId: null,
    valorBase: "0",
    valorAtual: "12",
    alvo: "20",
    ativo: true,
    medicoes: [],
    responsavelUser: null,
    metaEstrategica: null,
    metaExecucao: { id: "meta-execucao", codigo: null, nome: "Entregar atendimento" },
  };
  stub(t, prisma.indicador, "findMany", async () => [legado]);
  const leitura = await ctx.request("/planejamento/indicadores", undefined, "GET");
  assert.equal(leitura.status, 200, JSON.stringify(leitura.json));
  assert.equal(leitura.json.data[0].id, "indicador-legado");
  assert.equal(leitura.json.data[0].metaExecucaoId, "meta-execucao");

  const novo = await ctx.request("/planejamento/indicadores", {
    metaExecucaoId: "meta-execucao",
    nome: "Outro indicador",
  });
  assert.equal(novo.status, 410);
  assert.equal(novo.json.error.code, "META_EXECUCAO_DESCONTINUADA");
  assert.equal(ctx.indicadoresCriados.length, 0);
});

test("indicador novo não pode apontar para meta de execução de outro município", async (t) => {
  const ctx = await setup(t, { metaExecucaoMunicipioId: "outro-municipio" });
  const response = await ctx.request("/planejamento/indicadores", {
    metaExecucaoId: "meta-execucao",
    nome: "Atendimentos realizados",
  });

  assert.equal(response.status, 410, JSON.stringify(response.json));
  assert.equal(response.json.error.code, "META_EXECUCAO_DESCONTINUADA");
  assert.equal(ctx.indicadoresCriados.length, 0);
});

test("detalhes de projeto de outro município permanecem isolados", async (t) => {
  const ctx = await setup(t, {
    iniciativa: { municipioId: "outro-municipio" },
  });
  const response = await ctx.request("/iniciativas/projeto");

  assert.equal(response.status, 403, JSON.stringify(response.json));
  assert.equal(response.json.error.code, "CROSS_MUNICIPIO_BLOCKED");
  assert.equal(ctx.auditLogs.length, 1);
});

test("criação de meta de execução não atravessa municípios", async (t) => {
  const ctx = await setup(t, {
    iniciativa: { municipioId: "outro-municipio" },
  });
  const response = await ctx.request("/iniciativas/projeto/metas-execucao", {
    nome: "Entregar atendimento",
  });

  assert.equal(response.status, 403, JSON.stringify(response.json));
  assert.equal(response.json.error.code, "CROSS_MUNICIPIO_BLOCKED");
  assert.equal(ctx.metasCriadas.length, 0);
  assert.equal(ctx.auditLogs.length, 1);
});
