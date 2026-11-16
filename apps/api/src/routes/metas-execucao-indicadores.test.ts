import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import express from "express";
import { prisma } from "@cip/db";
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
  };
}

for (const classificacao of ["ESTRUTURANTE", "PRIORITARIO"]) {
  test(`meta de execução de ${classificacao} não exige vínculo ao Plano de Governo`, async (t) => {
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

    assert.equal(response.status, 201, JSON.stringify(response.json));
    assert.equal(response.json.data.iniciativaId, "projeto");
    assert.equal(ctx.metasCriadas.length, 1);
    assert.equal(ctx.metasCriadas[0].iniciativaId, "projeto");
    assert.equal("metaEstrategicaId" in ctx.metasCriadas[0], false);
  });
}

test("indicador pode ser cadastrado somente na meta de execução do projeto", async (t) => {
  const ctx = await setup(t);
  const response = await ctx.request("/planejamento/indicadores", {
    metaExecucaoId: "meta-execucao",
    nome: "Atendimentos realizados",
    valorBase: "0",
    alvo: "100",
    periodicidade: "MENSAL",
  });

  assert.equal(response.status, 201, JSON.stringify(response.json));
  assert.equal(response.json.data.metaExecucaoId, "meta-execucao");
  assert.equal(response.json.data.metaEstrategicaId, undefined);
  assert.equal(ctx.indicadoresCriados.length, 1);
  assert.equal(ctx.indicadoresCriados[0].municipioId, "municipio");
  assert.equal(ctx.indicadoresCriados[0].metaExecucaoId, "meta-execucao");
  assert.equal("metaEstrategicaId" in ctx.indicadoresCriados[0], false);
});

test("indicador não pode apontar para meta de execução de outro município", async (t) => {
  const ctx = await setup(t, { metaExecucaoMunicipioId: "outro-municipio" });
  const response = await ctx.request("/planejamento/indicadores", {
    metaExecucaoId: "meta-execucao",
    nome: "Atendimentos realizados",
  });

  assert.equal(response.status, 422, JSON.stringify(response.json));
  assert.equal(response.json.error.code, "INVALID_META_EXEC");
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
