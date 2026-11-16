import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import express from "express";
import { prisma, type Prisma } from "@cip/db";
import { errorHandler } from "../middleware/error";
import { signAccessToken } from "../middleware/auth";
import { reportsRouter } from "./reports";

process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/reports_tests?connect_timeout=1";
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

async function setup(t: TestContext, role: "admin" | "gestor" = "admin") {
  const agora = new Date();
  const iniciativa = {
    id: "projeto",
    municipioId: "municipio",
    secretariaPrincipalId: "secretaria",
    codigo: "P-1",
    nome: "Projeto histórico",
    dataReferencia: agora,
    marcos: [
      {
        id: "tarefa-legada",
        codigo: "T-1",
        descricao: "Tarefa historicamente vinculada",
        metaExecucaoId: "meta-legada",
        ...datasTarefa(),
        responsavel: null,
        subtarefas: [],
        evidencias: [],
        _count: { reprogramacoes: 0 },
      },
      {
        id: "tarefa-direta",
        codigo: "T-2",
        descricao: "Tarefa diretamente vinculada",
        metaExecucaoId: null,
        ...datasTarefa(),
        responsavel: null,
        subtarefas: [],
        evidencias: [{
          id: "ev-1", tipo: "FOTO", status: "VERIFICADA", createdAt: new Date("2026-11-16T23:59:59.999Z"),
        }],
        _count: { reprogramacoes: 0 },
      },
    ],
    evidencias: [{
      id: "ev-1", tipo: "FOTO", status: "VERIFICADA", createdAt: new Date("2026-11-16T23:59:59.999Z"),
    }],
  };

  stub(t, prisma.user, "findUnique", async () => ({ active: true, isPlatformAdmin: role === "admin" }));
  stub(t, prisma.municipio, "findFirst", async () => ({ id: "municipio", nome: "Município" }));
  stub(t, prisma.vinculoUsuarioMunicipio, "findUnique", async () => ({ roleCode: role, secretariaId: "secretaria" }));
  stub(t, prisma.secretaria, "findMany", async () => [{
    id: "secretaria",
    nome: "Secretaria",
    sigla: "SEC",
    titularNome: null,
  }, {
    id: "correlacionada", nome: "Secretaria correlacionada", sigla: "COR", titularNome: null,
  }, {
    id: "sem-acesso", nome: "Secretaria sem acesso", sigla: "NÃO", titularNome: null,
  }]);
  stub(t, prisma.iniciativa, "findMany", async (args: Prisma.IniciativaFindManyArgs) => {
    assert.deepEqual(args.where, { municipioId: "municipio", AND: [role === "admin" ? {} : {
      OR: [{ secretariaPrincipalId: "secretaria" }, { secretarias: { some: { secretariaId: "secretaria" } } }],
    }] });
    return [iniciativa];
  });
  stub(t, prisma.planoGoverno, "findFirst", async () => null);
  stub(t, prisma.metaEstrategica, "findMany", async () => [{
    id: "meta-estrategica",
    nome: "Meta estratégica do projeto",
    unidade: "%",
    alvo: "80",
    valorBase: "20",
    secretaria: { nome: "Secretaria", sigla: "SEC" },
    medicoes: [],
    iniciativas: [{
      id: iniciativa.id,
      codigo: iniciativa.codigo,
      nome: iniciativa.nome,
    }],
    indicadores: [{
      id: "indicador-1",
      nome: "Indicador da meta",
      unidade: "%",
      valorBase: "20",
      alvo: "80",
      valorAtual: "35",
      periodicidade: "MENSAL",
      medicoes: [{ valorRealizado: "32", dataCorte: agora }],
    }],
  }]);
  stub(t, prisma.auditLog, "create", async () => ({}));

  const app = express();
  app.use("/reports", reportsRouter);
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
    id: "usuario",
    email: "qa@example.invalid",
    name: "QA",
    municipioId: "municipio",
    municipioNome: "Município",
    role,
    isPlatformAdmin: role === "admin",
    permissions: [],
  });
  const headers = { Authorization: `Bearer ${token}` };

  return { base, headers, iniciativa, agora };
}

function datasTarefa(
  prazoVigente: Date | null = null,
  prazoOriginal: Date | null = null,
  concluidoEm: Date | null = null,
) {
  return { prazoVigente, prazoOriginal, concluidoEm };
}

test("relatório mantém a contagem de todas as tarefas sem expor metas de execução", async (t) => {
  const { base, headers, agora } = await setup(t);
  const jsonResponse = await fetch(`${base}/reports/prestacao.json`, { headers });
  assert.equal(jsonResponse.status, 200);
  const { data } = await jsonResponse.json() as { data: {
    resumo: { total: number };
    tarefas: Array<{ id: string; descricao: string }>;
    metasEstrategicas: Array<{
      id: string;
      projetos: Array<{ id: string }>;
      indicadores: Array<{
        id: string;
        nome: string;
        valorBase: string;
        valorAtual: string;
        alvo: string;
        medicao: { valorRealizado: string } | null;
      }>;
      pct?: number;
    }>;
    metasExecucao?: unknown;
  } };
  assert.equal(data.resumo.total, 2);
  assert.deepEqual(new Set(data.tarefas.map((t) => t.id)), new Set(["tarefa-legada", "tarefa-direta"]));
  assert.ok(data.tarefas.some((t) => t.descricao === "Tarefa historicamente vinculada"));
  assert.equal("metasExecucao" in data, false);
  assert.equal(data.metasEstrategicas.length, 1);
  assert.deepEqual(data.metasEstrategicas[0].projetos.map((projeto) => projeto.id), ["projeto"]);
  assert.deepEqual(data.metasEstrategicas[0].indicadores, [{
    id: "indicador-1",
    nome: "Indicador da meta",
    unidade: "%",
    valorBase: "20",
    alvo: "80",
    valorAtual: "35",
    periodicidade: "MENSAL",
    medicao: { valorRealizado: "32", dataCorte: agora.toISOString() },
  }]);
  assert.equal("pct" in data.metasEstrategicas[0], false);

  const csvResponse = await fetch(`${base}/reports/prestacao.csv`, { headers });
  assert.equal(csvResponse.status, 200);
  const csv = await csvResponse.text();
  assert.equal(csv.trim().split("\n").length, 3);
  assert.doesNotMatch(csv.split("\n")[0], /Meta/);
  assert.match(csv, /Tarefa historicamente vinculada/);
  assert.match(csv, /Tarefa diretamente vinculada/);
});

test("JSON, snapshot CSV e endpoint CSV aplicam a mesma busca e ordenação", async (t) => {
  const { base, headers } = await setup(t);
  const query = "?tipo=tarefas&busca=historicamente&ordenar=tarefa&direcao=desc";
  const response = await fetch(`${base}/reports/prestacao.json${query}`, { headers });
  assert.equal(response.status, 200);
  const { data } = await response.json();
  assert.equal(data.consulta.total, 1);
  assert.equal(data.consulta.linhas[0].id, "tarefa-legada");
  assert.equal(data.consulta.ordenar, "tarefa");
  assert.equal(data.consulta.direcao, "desc");
  assert.match(data.csv, /Tarefa historicamente vinculada/);
  assert.doesNotMatch(data.csv, /Tarefa diretamente vinculada/);
  const csvResponse = await fetch(`${base}/reports/prestacao.csv${query}`, { headers });
  assert.equal(csvResponse.status, 200);
  // fetch remove o BOM UTF-8 ao decodificar a resposta.
  assert.equal(await csvResponse.text(), data.csv.replace(/^\uFEFF/, ""));
});

test("relatório e CSV mantêm mais de 500 tarefas e metas estratégicas", async (t) => {
  const { base, headers, iniciativa } = await setup(t);
  const modelo = iniciativa.marcos[0];
  iniciativa.marcos = Array.from({ length: 605 }, (_, i) => ({
    ...modelo, id: `tarefa-${i}`, codigo: `T-${i}`, descricao: `Tarefa ${i}`,
  }));
  const response = await fetch(`${base}/reports/prestacao.json?tipo=tarefas&ordenar=codigo`, { headers });
  const { data } = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.resumo.total, 605);
  assert.equal(data.tarefas.length, 605);
  assert.equal(data.consulta.total, 605);
  assert.equal(data.csv.trim().split("\n").length, 606);
  const metasResponse = await fetch(`${base}/reports/prestacao.json?tipo=metas`, { headers });
  const metas = (await metasResponse.json()).data;
  assert.equal(metas.consulta.total, 1);
  assert.equal(metas.consulta.linhas[0].valores.indicador, "Indicador da meta");
  assert.match(metas.csv, /Meta estratégica do projeto/);
  assert.match(metas.csv, /Indicador da meta/);
});

test("filtros inválidos não são descartados silenciosamente", async (t) => {
  const { base, headers } = await setup(t);
  for (const query of [
    "de=2026-02-30", "de=2026-11-17&ate=2026-11-16", "status=invalido",
    "tipo=invalido", "direcao=invalida", "tipo=metas&ordenar=tarefa",
    "tipo=metas&status=VENCIDO", "tipo=evidencias&status=VENCIDO",
    "tipo=tarefas&tipo=metas", "de=2026-11-16&de=2026-11-17",
  ]) {
    for (const formato of ["json", "csv"]) {
      const response = await fetch(`${base}/reports/prestacao.${formato}?${query}`, { headers });
      assert.equal(response.status, 400, `${formato}: ${query}`);
      assert.equal((await response.json()).error.code, "VALIDATION_ERROR");
    }
  }
});

test("filtros sem resultados retornam CSV apenas com cabeçalho, sem perder autenticação", async (t) => {
  const { base, headers } = await setup(t);
  const response = await fetch(`${base}/reports/prestacao.json?busca=inexistente`, { headers });
  const { data } = await response.json();
  assert.equal(data.consulta.total, 0);
  assert.equal(data.csv.trim().split("\n").length, 1);
  const semSessao = await fetch(`${base}/reports/prestacao.csv`);
  assert.equal(semSessao.status, 401);
});

test("gestor preserva tarefas de projetos correlacionados sem expor secretarias alheias", async (t) => {
  const { base, headers, iniciativa } = await setup(t, "gestor");
  iniciativa.secretariaPrincipalId = "correlacionada";
  const response = await fetch(`${base}/reports/prestacao.json?tipo=tarefas`, { headers });
  assert.equal(response.status, 200);
  const { data } = await response.json();
  assert.equal(data.consulta.total, 2);
  assert.equal(data.consulta.linhas[0].valores.secretaria, "COR");
  assert.deepEqual(data.opcoes.secretarias.map((s: { id: string }) => s.id), ["secretaria", "correlacionada"]);
  const bloqueado = await fetch(`${base}/reports/prestacao.json?secretariaId=sem-acesso`, { headers });
  assert.equal((await bloqueado.json()).data.consulta.total, 0);
});

test("período inclusivo combina secretaria, projeto e situação e exporta evidências reais", async (t) => {
  const { base, headers, iniciativa } = await setup(t);
  iniciativa.marcos[0].prazoVigente = new Date("2026-11-16T00:00:00.000Z");
  iniciativa.marcos[0].concluidoEm = new Date("2026-11-16T23:59:59.999Z");
  const query = "?secretariaId=secretaria&projetoId=projeto&de=2026-11-16&ate=2026-11-16";
  const tarefas = await fetch(`${base}/reports/prestacao.json${query}&tipo=tarefas&status=CONCLUIDO`, { headers });
  const data = (await tarefas.json()).data;
  assert.equal(data.consulta.total, 1);
  assert.equal(data.consulta.linhas[0].id, "tarefa-legada");
  const evidencias = await fetch(`${base}/reports/prestacao.json${query}&tipo=evidencias`, { headers });
  const evidencia = (await evidencias.json()).data;
  assert.equal(evidencia.consulta.total, 1);
  assert.equal(evidencia.consulta.linhas[0].valores.id, "ev-1");
  assert.match(evidencia.csv, /FOTO;VERIFICADA;2026-11-16/);
  assert.doesNotMatch(evidencia.csv, /Tarefa historicamente vinculada/);
  const fora = await fetch(`${base}/reports/prestacao.json?tipo=evidencias&de=2026-11-17`, { headers });
  assert.equal((await fora.json()).data.consulta.total, 0);
});

test("CSV do retrato exibido não muda quando os registros são alterados depois", async (t) => {
  const { base, headers, iniciativa } = await setup(t);
  const response = await fetch(`${base}/reports/prestacao.json?tipo=tarefas`, { headers });
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const { data } = await response.json();
  iniciativa.marcos[0].descricao = "Texto atualizado depois da consulta";
  const novoCsv = await fetch(`${base}/reports/prestacao.csv?tipo=tarefas`, { headers });
  assert.match(await novoCsv.text(), /Texto atualizado depois da consulta/);
  assert.match(data.csv, /Tarefa historicamente vinculada/);
  assert.doesNotMatch(data.csv, /Texto atualizado depois da consulta/);
  assert.equal(data.consulta.linhas.find((l: { id: string }) => l.id === "tarefa-legada").valores.tarefa, "Tarefa historicamente vinculada");
});

test("evolução mensal usa os mesmos dias UTC do filtro e da tabela nos limites do mês", async (t) => {
  const { base, headers, iniciativa } = await setup(t);
  iniciativa.dataReferencia = new Date("2026-11-16T12:00:00Z");
  iniciativa.marcos[0].prazoVigente = new Date("2026-11-01T00:00:00Z");
  iniciativa.marcos[0].concluidoEm = new Date("2026-11-01T00:00:00Z");
  iniciativa.marcos[1].prazoVigente = new Date("2026-11-30T00:00:00Z");

  const response = await fetch(`${base}/reports/prestacao.json?de=2026-11-01&ate=2026-11-30`, { headers });
  assert.equal(response.status, 200);
  const { data } = await response.json();
  assert.equal(data.consulta.total, 2);
  assert.deepEqual(data.evolucao, [{
    chave: "2026-11", previstas: 2, entregues: 1, noPrazo: 1, atrasadas: 0,
  }]);
});

test("sessão revogada não consulta nem exporta dados", async (t) => {
  const { base, headers } = await setup(t);
  stub(t, prisma.user, "findUnique", async () => ({ active: false, isPlatformAdmin: false }));
  let consultas = 0;
  stub(t, prisma.iniciativa, "findMany", async () => { consultas++; return []; });
  for (const formato of ["json", "csv"]) {
    const response = await fetch(`${base}/reports/prestacao.${formato}`, { headers });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error.code, "UNAUTHORIZED");
  }
  assert.equal(consultas, 0);
});
