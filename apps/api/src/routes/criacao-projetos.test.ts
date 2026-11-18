import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import express from "express";
import { Prisma, prisma } from "@cip/db";
import {
  CLASSIFICACAO_PROJETO,
  CODIGOS_IMPEDIMENTOS_COMUNS,
  MODELO_ACAO_DIARIA,
} from "@cip/shared";
import { signAccessToken } from "../middleware/auth";
import { errorHandler, HttpError } from "../middleware/error";
import { iniciativasRouter } from "./iniciativas";
import { wizardRouter } from "./wizard";
import { notifications } from "../services/notifications";

// Nenhum teste desta suite usa banco, mesmo se faltar um mock.
process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/criacao_tests?connect_timeout=1";
process.env.DIRECT_URL = process.env.DATABASE_URL;

const escopo = [{
  codigo: "TAREFA",
  nivel: "TAREFA",
  nome: "Entrega",
  children: [],
}];

function stub(t: TestContext, target: object, method: string, implementation: (...args: never[]) => unknown) {
  // Os descriptors das proxies Prisma nao expõem o metodo para mock.method.
  const original = Reflect.get(target, method);
  assert.equal(typeof original, "function", method);
  Reflect.set(target, method, implementation);
  t.after(() => { Reflect.set(target, method, original); });
}

async function setup(t: TestContext, options: { falharEscopo?: boolean } = {}) {
  const iniciativas: Prisma.IniciativaUncheckedCreateInput[] = [];
  const classificacoes: Prisma.IniciativaClassificacaoCreateManyInput[] = [];
  const respostas: Prisma.IniciativaRespostaViabilidadeUncheckedCreateInput[] = [];
  const atualizacoes: Prisma.IniciativaRespostaViabilidadeUncheckedUpdateInput[] = [];
  const historico: Prisma.IniciativaRespostaHistoricoUncheckedCreateInput[] = [];
  const existentes: Array<{ id: string; perguntaCodigo: string; valor: Prisma.JsonValue }> = [];
  const transacoes: number[] = [];
  const metasEstrategicas: Prisma.MetaEstrategicaUncheckedCreateInput[] = [];
  const planos: Prisma.PlanoGovernoUncheckedCreateInput[] = [];
  const tarefas: Prisma.MarcoEntregaUncheckedCreateInput[] = [];
  let emTransacao = false;
  const secretaria = { id: "secretaria", municipioId: "municipio", active: true };

  stub(t, prisma.user, "findUnique", async () => ({ active: true, isPlatformAdmin: true }));
  stub(t, prisma.municipio, "findFirst", async () => ({ id: "municipio", nome: "Município" }));
  stub(t, prisma.vinculoUsuarioMunicipio, "findUnique", async () => null);
  stub(t, prisma.secretaria, "findFirst", async () => secretaria);
  stub(t, prisma.secretaria, "findMany", async ({ where }: { where: Prisma.SecretariaWhereInput }) => {
    assert.equal(where.municipioId, "municipio");
    const ids = typeof where.id === "object" ? where.id.in : [];
    assert.ok(Array.isArray(ids));
    return ["secretaria", "correlata"].filter((id) => ids.includes(id)).map((id) => ({ id }));
  });
  stub(t, prisma.metaEstrategica, "findFirst", async () => ({ id: "meta" }));
  stub(t, prisma.planoGoverno, "findFirst", async () => ({ id: "plano" }));
  stub(t, prisma.planoGoverno, "create", async ({ data }: { data: Prisma.PlanoGovernoUncheckedCreateInput }) => {
    assert.equal(emTransacao, true);
    planos.push(data);
    return { ...data, id: "novo-plano" };
  });
  stub(t, prisma.metaEstrategica, "create", async ({ data }: { data: Prisma.MetaEstrategicaUncheckedCreateInput }) => {
    assert.equal(emTransacao, true);
    metasEstrategicas.push(data);
    return { ...data, id: "nova-meta" };
  });
  stub(t, prisma.compromisso, "findMany", async () => [{ id: "compromisso" }]);
  stub(t, prisma.secretariaPessoa, "findFirst", async () => ({ id: "pessoa", nome: "Responsável" }));
  stub(t, prisma.secretariaPessoa, "create", async () => ({ id: "nova-pessoa", nome: "Nova pessoa" }));
  stub(t, prisma.auditLog, "create", async () => ({}));
  stub(t, prisma.iniciativaSecretaria, "create", async () => ({}));
  stub(t, prisma.metaExecucao, "create", async () => {
    assert.fail("Wizard nao pode criar metas de execucao");
  });
  stub(t, prisma.marcoEntrega, "create", async ({ data }: { data: Prisma.MarcoEntregaUncheckedCreateInput }) => {
    if (options.falharEscopo) throw new HttpError(422, "ESCOPO_TESTE", "Falha simulada no escopo");
    assert.equal(emTransacao, true);
    tarefas.push(data);
    return { ...data, id: "tarefa" };
  });
  stub(t, prisma.tipoVerificacao, "upsert", async ({ create }: { create: Prisma.TipoVerificacaoCreateInput }) => ({ id: create.codigo }));
  stub(t, prisma.verificacao, "upsert", async () => ({}));
  t.mock.method(notifications, "notifyResponsavelBloqueio", async () => {});
  stub(t, prisma.iniciativa, "findUnique", async () => ({
    id: "projeto",
    municipioId: "municipio",
    fluxoWizard: "ACAO_DIARIA",
    ciclo: "EM_PLANEJAMENTO",
    modeloSnapshot: MODELO_ACAO_DIARIA,
    secretariaPrincipal: { nome: "Secretaria" },
    respostasViabilidade: existentes,
  }));
  stub(t, prisma.iniciativa, "create", async ({ data }: { data: Prisma.IniciativaUncheckedCreateInput }) => {
    assert.equal(emTransacao, true);
    // Reproduz as restricoes unicas das tabelas de vinculo.
    for (const entries of [data.secretarias?.create, data.compromissos?.create]) {
      if (Array.isArray(entries)) {
        const ids = entries.map((entry) => "secretariaId" in entry ? entry.secretariaId : "compromissoId" in entry ? entry.compromissoId : undefined);
        assert.equal(new Set(ids).size, ids.length, "Vinculo duplicado na persistencia");
      }
    }
    iniciativas.push(data);
    return { ...data, id: `projeto-${iniciativas.length}` };
  });
  stub(t, prisma.iniciativaClassificacao, "createMany", async ({ data }: { data: Prisma.IniciativaClassificacaoCreateManyInput[] }) => {
    classificacoes.push(...data);
    return { count: data.length };
  });
  stub(t, prisma.iniciativaRespostaViabilidade, "create", async ({ data }: { data: Prisma.IniciativaRespostaViabilidadeUncheckedCreateInput }) => {
    assert.ok(!respostas.some((r) =>
      r.iniciativaId === data.iniciativaId && r.perguntaCodigo === data.perguntaCodigo,
    ), "Resposta duplicada");
    respostas.push(data);
    return { ...data, id: "resposta" };
  });
  stub(t, prisma.iniciativaRespostaViabilidade, "update", async ({ data }: { data: Prisma.IniciativaRespostaViabilidadeUncheckedUpdateInput }) => {
    atualizacoes.push(data);
    return { id: "resposta", ...data };
  });
  stub(t, prisma.iniciativaRespostaHistorico, "create", async ({ data }: { data: Prisma.IniciativaRespostaHistoricoUncheckedCreateInput }) => {
    historico.push(data);
    return { ...data, id: "historico" };
  });
  stub(t, prisma.iniciativa, "update", async () => ({ id: "projeto" }));
  stub(t, prisma, "$transaction", async (run: (tx: Prisma.TransactionClient) => Promise<unknown>) => {
    transacoes.push(1);
    const anteriores = [iniciativas.length, classificacoes.length, metasEstrategicas.length, planos.length, respostas.length];
    emTransacao = true;
    try {
      return await run(prisma);
    } catch (error) {
      [iniciativas.length, classificacoes.length, metasEstrategicas.length, planos.length, respostas.length] = anteriores;
      throw error;
    } finally {
      emTransacao = false;
    }
  });

  const app = express();
  app.use(express.json());
  app.use("/iniciativas/wizard", wizardRouter);
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
    id: "usuario", email: "qa@example.invalid", name: "QA",
    municipioId: "municipio", municipioNome: "Município",
    role: "admin", isPlatformAdmin: true, permissions: [],
  });
  async function request(path: string, body: object, method = "POST") {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const json = await response.json();
    return { status: response.status, json };
  }
  return { iniciativas, classificacoes, respostas, atualizacoes, historico, existentes, transacoes, metasEstrategicas, planos, tarefas, request };
}

const cadastro = {
  codigo: "QA-01", nome: "Projeto QA", secretariaPrincipalId: "secretaria", metaEstrategicaId: "meta",
};
const impedimentosRespondidos = CODIGOS_IMPEDIMENTOS_COMUNS.map((perguntaCodigo) => ({
  perguntaCodigo,
  valor: "nao_se_aplica",
}));
const wizard = {
  ...cadastro,
  classificacaoPrincipal: "ACAO_DIARIA",
  responsavelPessoaId: "pessoa",
  estruturaOverride: escopo,
  respostas: impedimentosRespondidos,
};

test("wizard persiste tarefas diretamente na iniciativa sem meta de execucao", async (t) => {
  const ctx = await setup(t);
  const response = await ctx.request("/iniciativas/wizard/confirmar", wizard);
  assert.equal(response.status, 201, JSON.stringify(response.json));
  assert.equal(ctx.tarefas.length, 1);
  assert.equal(ctx.tarefas[0].iniciativaId, "projeto-1");
  assert.equal("metaExecucaoId" in ctx.tarefas[0], false);
});

test("preview permite escopo vazio mas confirmar rejeita sem sintetizar tarefas", async (t) => {
  const ctx = await setup(t);
  const body = { ...wizard, estruturaOverride: [] };
  const preview = await ctx.request("/iniciativas/wizard/preview", body);
  assert.equal(preview.status, 200, JSON.stringify(preview.json));
  assert.deepEqual(preview.json.data.estrutura, []);
  const confirmacao = await ctx.request("/iniciativas/wizard/confirmar", body);
  assert.equal(confirmacao.status, 422, JSON.stringify(confirmacao.json));
  assert.equal(confirmacao.json.error.code, "ESCOPO_INCOMPLETO");
  assert.equal(ctx.transacoes.length, 0);
  assert.equal(ctx.iniciativas.length, 0);
  assert.equal(ctx.tarefas.length, 0);
});

for (const path of ["/iniciativas", "/iniciativas/wizard/confirmar", "/iniciativas/wizard/preview"]) {
  test(`rejeita pedidos explicitos de metas de execucao em ${path}`, async (t) => {
    const ctx = await setup(t);
    for (const extra of [
      { metaExecucaoId: "legada" },
      { metasExecucao: [{ nome: "Meta nova" }] },
    ]) {
      const response = await ctx.request(path, { ...cadastro, ...wizard, ...extra });
      assert.equal(response.status, 400, JSON.stringify(response.json));
      assert.equal(response.json.error.code, "VALIDATION_ERROR");
    }
    assert.equal(ctx.transacoes.length, 0);
    assert.equal(ctx.iniciativas.length, 0);
  });
}

for (const path of ["/iniciativas/wizard/preview", "/iniciativas/wizard/confirmar"]) {
  test(`override nao pode criar metas de execucao em ${path}`, async (t) => {
    const ctx = await setup(t);
    const response = await ctx.request(path, {
      ...wizard,
      estruturaOverride: [{ ...escopo[0], nivel: "META" }],
    });
    assert.equal(response.status, 400, JSON.stringify(response.json));
    assert.equal(ctx.transacoes.length, 0);
  });

  test(`override exige tarefas e subtarefas bem formadas em ${path}`, async (t) => {
    const ctx = await setup(t);
    for (const estruturaOverride of [
      [{ ...escopo[0], nivel: "SUBTAREFA" }],
      [{ ...escopo[0], children: [{ ...escopo[0], codigo: "ANINHADA" }] }],
    ]) {
      const response = await ctx.request(path, { ...wizard, estruturaOverride });
      assert.equal(response.status, 422, JSON.stringify(response.json));
      assert.equal(response.json.error.code, "ESCOPO_INVALIDO");
    }
    assert.equal(ctx.transacoes.length, 0);
  });
}

for (const novoPlano of [false, true]) {
  test(`wizard cria meta e projeto na mesma transacao, novo plano=${novoPlano}`, async (t) => {
    const ctx = await setup(t);
    const response = await ctx.request("/iniciativas/wizard/confirmar", {
      ...wizard,
      metaEstrategicaId: undefined,
      novaMeta: { nome: "Meta estrategica", ...(novoPlano ? { novoPlanoNome: "Plano novo" } : { planoId: "plano" }) },
    });
    assert.equal(response.status, 201, JSON.stringify(response.json));
    assert.equal(ctx.transacoes.length, 1);
    assert.equal(ctx.metasEstrategicas.length, 1);
    assert.equal(ctx.iniciativas[0].metaEstrategicaId, "nova-meta");
    assert.equal(ctx.metasEstrategicas[0].planoId, novoPlano ? "novo-plano" : "plano");
    assert.equal(ctx.planos.length, novoPlano ? 1 : 0);
  });

  test(`falha posterior no wizard desfaz meta, projeto e plano, novo plano=${novoPlano}`, async (t) => {
    const ctx = await setup(t, { falharEscopo: true });
    const response = await ctx.request("/iniciativas/wizard/confirmar", {
      ...wizard,
      metaEstrategicaId: undefined,
      novaMeta: { nome: "Meta estrategica", ...(novoPlano ? { novoPlanoNome: "Plano novo" } : { planoId: "plano" }) },
    });
    assert.equal(response.status, 422, JSON.stringify(response.json));
    assert.equal(response.json.error.code, "ESCOPO_TESTE");
    assert.equal(ctx.transacoes.length, 1);
    assert.equal(ctx.metasEstrategicas.length, 0);
    assert.equal(ctx.iniciativas.length, 0);
    assert.equal(ctx.planos.length, 0);
  });
}

for (const classificacao of CLASSIFICACAO_PROJETO) {
  test(`cadastro direto preserva o tipo ${classificacao}`, async (t) => {
    const ctx = await setup(t);
    const response = await ctx.request("/iniciativas", {
      ...cadastro,
      classificacaoPrincipal: classificacao,
      ...(classificacao === "PLANO_GOVERNO" ? { metaEstrategicaId: "meta" } : {}),
    });
    assert.equal(response.status, 201, JSON.stringify(response.json));
    assert.equal(ctx.iniciativas[0].classificacaoPrincipal, classificacao);
    assert.equal(ctx.iniciativas[0].estruturante, classificacao === "ESTRUTURANTE");
    assert.equal(ctx.iniciativas[0].vinculoPlanoGoverno, classificacao === "PLANO_GOVERNO");
    assert.deepEqual(ctx.classificacoes.map((item) => item.classificacao), [classificacao]);
  });

  test(`wizard preserva o tipo ${classificacao}`, async (t) => {
    const ctx = await setup(t);
    const response = await ctx.request("/iniciativas/wizard/confirmar", {
      ...wizard,
      classificacaoPrincipal: classificacao,
      ...(classificacao === "PLANO_GOVERNO" ? { metaEstrategicaId: "meta" } : {}),
    });
    assert.equal(response.status, 201, JSON.stringify(response.json));
    assert.equal(ctx.iniciativas[0].classificacaoPrincipal, classificacao);
    assert.equal(ctx.iniciativas[0].fluxoWizard, classificacao);
    assert.deepEqual(ctx.classificacoes.map((item) => item.classificacao), [classificacao]);
  });
}

for (const [path, body] of [
  ["/iniciativas", cadastro],
  ["/iniciativas/wizard/confirmar", wizard],
] as const) {
  test(`gera e retorna UUID v4 completo quando codigo é omitido em ${path}`, async (t) => {
    const ctx = await setup(t);
    const { codigo: _codigo, ...semCodigo } = body;
    const codigos = new Set<string>();
    for (let i = 0; i < 2; i++) {
      const response = await ctx.request(path, semCodigo);
      assert.equal(response.status, 201, JSON.stringify(response.json));
      const codigo = response.json.data.codigo;
      assert.match(codigo, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      assert.equal(codigo, ctx.iniciativas[i].codigo);
      codigos.add(codigo);
    }
    assert.equal(codigos.size, 2);
  });

  test(`preserva código manual e o retorna em ${path}`, async (t) => {
    const ctx = await setup(t);
    const codigo = "MANUAL-2026-001";
    const response = await ctx.request(path, { ...body, codigo });
    assert.equal(response.status, 201, JSON.stringify(response.json));
    assert.equal(response.json.data.codigo, codigo);
    assert.equal(ctx.iniciativas[0].codigo, codigo);
  });

  test(`codigo vazio, curto ou nulo não aciona geração em ${path}`, async (t) => {
    const ctx = await setup(t);
    for (const codigo of ["", "A", null]) {
      const response = await ctx.request(path, { ...body, codigo });
      assert.equal(response.status, 400, JSON.stringify(response.json));
      assert.equal(response.json.error.code, "VALIDATION_ERROR");
    }
    assert.equal(ctx.transacoes.length, 0);
  });

  test(`colisão de UUID automático mantém 409 em ${path}`, async (t) => {
    const ctx = await setup(t);
    const { codigo: _codigo, ...semCodigo } = body;
    stub(t, prisma.iniciativa, "create", async ({ data }: { data: Prisma.IniciativaUncheckedCreateInput }) => {
      assert.match(data.codigo, /^[0-9a-f-]{36}$/);
      throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: Prisma.prismaVersion.client,
        meta: { modelName: "Iniciativa", target: ["municipioId", "codigo"] },
      });
    });
    const response = await ctx.request(path, semCodigo);
    assert.equal(response.status, 409, JSON.stringify(response.json));
    assert.equal(response.json.error.code, "CODIGO_INICIATIVA_DUPLICADO");
    assert.equal(ctx.iniciativas.length, 0);
  });

  test(`colisão de código retorna 409 sem renomear em ${path}`, async (t) => {
    const ctx = await setup(t);
    stub(t, prisma.iniciativa, "create", async ({ data }: { data: Prisma.IniciativaUncheckedCreateInput }) => {
      assert.equal(data.codigo, cadastro.codigo);
      assert.equal(data.municipioId, "municipio");
      throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: Prisma.prismaVersion.client,
        meta: { modelName: "Iniciativa", target: ["municipioId", "codigo"] },
      });
    });
    const response = await ctx.request(path, body);
    assert.equal(response.status, 409, JSON.stringify(response.json));
    assert.equal(response.json.error.code, "CODIGO_INICIATIVA_DUPLICADO");
    assert.equal(ctx.iniciativas.length, 0);
    assert.equal(ctx.classificacoes.length, 0);
    assert.equal(ctx.respostas.length, 0);
  });
}

test("cadastro direto rejeita categorias conflitantes em vez de trocar o tipo", async (t) => {
  const ctx = await setup(t);
  for (const extra of [
    { classificacaoPrincipal: "PRIORITARIO", classificacoes: ["ACAO_DIARIA"] },
    { classificacaoPrincipal: "ESTRUTURANTE", classificacoes: [] },
    { classificacaoPrincipal: "INEXISTENTE" },
  ]) {
    const response = await ctx.request("/iniciativas", { ...cadastro, ...extra });
    assert.equal(response.status, 400, JSON.stringify(response.json));
  }
  assert.equal(ctx.iniciativas.length, 0);
});

test("cadastro direto mantém os formatos legados de classificação", async (t) => {
  const ctx = await setup(t);
  for (const extra of [{}, { estruturante: true }, { classificacoes: ["PRIORITARIO"] }]) {
    const response = await ctx.request("/iniciativas", { ...cadastro, ...extra });
    assert.equal(response.status, 201, JSON.stringify(response.json));
  }
  assert.deepEqual(ctx.iniciativas.map((item) => item.classificacaoPrincipal), [null, "ESTRUTURANTE", "PRIORITARIO"]);
});

test("IDs repetidos não impedem cadastro nem duplicam vínculos", async (t) => {
  const ctx = await setup(t);
  const response = await ctx.request("/iniciativas", {
    ...cadastro,
    secretariaIds: ["secretaria", "correlata", "correlata"],
    compromissoIds: ["compromisso", "compromisso"],
  });
  assert.equal(response.status, 201, JSON.stringify(response.json));
  assert.deepEqual(ctx.iniciativas[0].secretarias?.create, [{
    secretariaId: "correlata", papel: "CORRESPONSAVEL", responsavel: undefined,
  }]);
  assert.deepEqual(ctx.iniciativas[0].compromissos?.create, [{
    compromissoId: "compromisso", tipoContribuicao: "DIRETA", origemVinculo: "CADASTRO_MANUAL",
  }]);
});

test("categoria Plano de Governo no cadastro direto exige vínculo", async (t) => {
  const ctx = await setup(t);
  const response = await ctx.request("/iniciativas", { ...cadastro, metaEstrategicaId: undefined, classificacaoPrincipal: "PLANO_GOVERNO" });
  assert.equal(response.status, 422);
  assert.equal(response.json.error.code, "PLANO_GOVERNO_LINK_REQUIRED");
  assert.equal(ctx.iniciativas.length, 0);
});

for (const [path, method] of [
  ["/iniciativas/wizard/preview", "POST"],
  ["/iniciativas/wizard/confirmar", "POST"],
  ["/iniciativas/wizard/projeto/viabilidade", "PATCH"],
]) {
  test(`perguntas duplicadas são rejeitadas antes de gravar em ${path}`, async (t) => {
    const ctx = await setup(t);
    const respostas = [
      { perguntaCodigo: "acao_impede_servico", valor: "Sim" },
      { perguntaCodigo: "acao_impede_servico", valor: "Não" },
    ];
    const response = await ctx.request(path, { ...wizard, respostas }, method);
    assert.equal(response.status, 400, JSON.stringify(response.json));
    assert.equal(response.json.error.code, "VALIDATION_ERROR");
    assert.equal(ctx.iniciativas.length, 0);
    assert.equal(ctx.respostas.length, 0);
    assert.equal(ctx.atualizacoes.length, 0);
  });
}

for (const valor of [null, false, 0, "", { valor: "Sim", detalhes: { pessoas_dia: 0 } }]) {
  test(`wizard preserva valor JSON ${JSON.stringify(valor)} na persistência`, async (t) => {
    const ctx = await setup(t);
    const response = await ctx.request("/iniciativas/wizard/confirmar", {
      ...wizard,
      respostas: [...impedimentosRespondidos, { perguntaCodigo: "acao_impede_servico", valor }],
    });
    assert.equal(response.status, 201, JSON.stringify(response.json));
    assert.deepEqual(ctx.respostas.find((r) => r.perguntaCodigo === "acao_impede_servico")?.valor, valor === null ? Prisma.JsonNull : valor);
  });
}

for (const classificacaoPrincipal of CLASSIFICACAO_PROJETO) {
  for (const perguntaCodigo of CODIGOS_IMPEDIMENTOS_COMUNS) {
    test(`confirmação direta rejeita ${perguntaCodigo} a_avaliar com detalhes em ${classificacaoPrincipal}`, async (t) => {
      const ctx = await setup(t);
      const response = await ctx.request("/iniciativas/wizard/confirmar", {
        ...wizard,
        classificacaoPrincipal,
        ...(classificacaoPrincipal === "PLANO_GOVERNO" ? { metaEstrategicaId: "meta" } : {}),
        novaPessoa: { nome: "Nova pessoa", cargo: "Analista" },
        respostas: impedimentosRespondidos.map((r) => r.perguntaCodigo === perguntaCodigo ? {
          perguntaCodigo,
          valor: {
            aplicabilidade: "a_avaliar",
            situacao: "atendida",
            detalhes: { descricao_outro: "Detalhes preenchidos", valor_verba: 1500 },
            fundamento: "Texto preenchido",
          },
        } : r),
      });
      assert.equal(response.status, 422, JSON.stringify(response.json));
      assert.equal(response.json.error.code, "IMPEDIMENTO_NAO_RESPONDIDO");
      assert.match(response.json.error.message, new RegExp(perguntaCodigo));
      assert.equal(ctx.iniciativas.length, 0);
      assert.equal(ctx.respostas.length, 0);
      assert.equal(ctx.transacoes.length, 0);
    });
  }
}

for (const valor of [
  undefined, null, "", "a_avaliar", "EM_ANDAMENTO",
  { detalhes: { descricao_outro: "Sem escolha de aplicabilidade" } },
  { fechada: "a_avaliar", detalhes: { descricao_outro: "Com detalhes" } },
  { aplicabilidade: "invalida", situacao: "atendida" },
]) {
  test(`confirmação rejeita impedimento sem decisão: ${JSON.stringify(valor)}`, async (t) => {
    const ctx = await setup(t);
    const respostas = impedimentosRespondidos.filter((r) => r.perguntaCodigo !== "outro_impedimento");
    const response = await ctx.request("/iniciativas/wizard/confirmar", {
      ...wizard,
      respostas: valor === undefined ? respostas : [...respostas, { perguntaCodigo: "outro_impedimento", valor }],
    });
    assert.equal(response.status, 422, JSON.stringify(response.json));
    assert.equal(response.json.error.code, "IMPEDIMENTO_NAO_RESPONDIDO");
    assert.equal(ctx.transacoes.length, 0);
  });
}

for (const valor of [
  "nao_se_aplica", "pendente", "atendida",
  { aplicabilidade: "nao", situacao: "dispensada_com_fundamento" },
  { aplicabilidade: "sim", situacao: "pendente" },
  { aplicabilidade: "sim", situacao: "atendida" },
  { fechada: "pendente" },
]) {
  test(`confirmação aceita aplicabilidade definida: ${JSON.stringify(valor)}`, async (t) => {
    const ctx = await setup(t);
    const response = await ctx.request("/iniciativas/wizard/confirmar", {
      ...wizard,
      respostas: impedimentosRespondidos.map((r) =>
        r.perguntaCodigo === "orcamento_recursos" ? { ...r, valor } : r),
    });
    assert.equal(response.status, 201, JSON.stringify(response.json));
    assert.equal(ctx.iniciativas.length, 1);
  });
}

test("preview continua disponível com impedimentos ainda a avaliar", async (t) => {
  const ctx = await setup(t);
  const response = await ctx.request("/iniciativas/wizard/preview", {
    ...wizard,
    respostas: [{ perguntaCodigo: "outro_impedimento", valor: {
      aplicabilidade: "a_avaliar", situacao: "em_analise", detalhes: { descricao_outro: "Rascunho" },
    } }],
  });
  assert.equal(response.status, 200, JSON.stringify(response.json));
  assert.equal(ctx.transacoes.length, 0);
});

test("reavaliação grava nova resposta nula como JSON null", async (t) => {
  const ctx = await setup(t);
  const response = await ctx.request("/iniciativas/wizard/projeto/viabilidade", {
    respostas: [{ perguntaCodigo: "acao_impede_servico", valor: null }],
  }, "PATCH");
  assert.equal(response.status, 200, JSON.stringify(response.json));
  assert.equal(ctx.respostas[0].valor, Prisma.JsonNull);
  assert.equal(ctx.historico.length, 0);
});

for (const [anterior, novo] of [[null, false], [0, null], [null, null], ["", 0]]) {
  test(`reavaliação preserva tipos no histórico: ${JSON.stringify(anterior)} → ${JSON.stringify(novo)}`, async (t) => {
    const ctx = await setup(t);
    ctx.existentes.push({ id: "resposta", perguntaCodigo: "acao_impede_servico", valor: anterior });
    const response = await ctx.request("/iniciativas/wizard/projeto/viabilidade", {
      respostas: [{ perguntaCodigo: "acao_impede_servico", valor: novo }],
    }, "PATCH");
    assert.equal(response.status, 200, JSON.stringify(response.json));
    assert.equal(ctx.atualizacoes[0].valor, novo === null ? Prisma.JsonNull : novo);
    assert.equal(ctx.historico[0].valorAnterior, anterior === null ? Prisma.JsonNull : anterior);
    assert.equal(ctx.historico[0].valorNovo, novo === null ? Prisma.JsonNull : novo);
  });
}

for (const classificacaoPrincipal of ["ESTRUTURANTE", "PRIORITARIO", "PLANO_GOVERNO", "ACAO_DIARIA"]) {
  test(`todo projeto exige meta estrategica: ${classificacaoPrincipal}`, async (t) => {
    const ctx = await setup(t);
    const response = await ctx.request("/iniciativas/wizard/confirmar", { ...wizard, metaEstrategicaId: undefined, classificacaoPrincipal });
    assert.equal(response.status, 422);
    assert.equal(response.json.error.code, "META_REQUIRED");
    assert.equal(ctx.iniciativas.length, 0);
  });
}

const itemPersonalizado = {
  codigo: "imp_personalizado_teste",
  nome: "Liberação de acesso ao local",
  tipo: "PRE_REQUISITO",
  descricao: "Confirmar acesso com a equipe responsável",
  bloqueante: true,
};

for (const classificacao of CLASSIFICACAO_PROJETO) {
  test(`itens personalizados participam da previa e sao persistidos em ${classificacao}`, async (t) => {
    const ctx = await setup(t);
    const body = {
      ...wizard,
      classificacaoPrincipal: classificacao,
      impedimentosPersonalizados: [itemPersonalizado, { ...itemPersonalizado, codigo: "imp_personalizado_outro", nome: "Equipe disponível", bloqueante: false, tipo: "IMPEDIMENTO" }],
      respostas: [...impedimentosRespondidos,
        { perguntaCodigo: itemPersonalizado.codigo, valor: { codigo: itemPersonalizado.codigo, aplicabilidade: "sim", situacao: "pendente", proximoPasso: "Solicitar liberação", responsavel: "Equipe local" } },
        { perguntaCodigo: "imp_personalizado_outro", valor: "atendida" },
      ],
    };
    const preview = await ctx.request("/iniciativas/wizard/preview", body);
    assert.equal(preview.status, 200, JSON.stringify(preview.json));
    assert.equal(preview.json.data.cicloInicial, "AGUARDANDO_PRE_REQUISITO");
    assert.ok(preview.json.data.bloqueios.some((b: { perguntaCodigo: string }) => b.perguntaCodigo === itemPersonalizado.codigo));
    const confirmacao = await ctx.request("/iniciativas/wizard/confirmar", body);
    assert.equal(confirmacao.status, 201, JSON.stringify(confirmacao.json));
    const snapshot = ctx.iniciativas[0].modeloSnapshot as unknown as { perguntas: Array<{ codigo: string; impacto: string; metadados?: { tipoCondicionante?: string } }> };
    assert.equal(snapshot.perguntas.find((p) => p.codigo === itemPersonalizado.codigo)?.impacto, "BLOQUEANTE");
    assert.equal(snapshot.perguntas.find((p) => p.codigo === itemPersonalizado.codigo)?.metadados?.tipoCondicionante, "PRE_REQUISITO");
    assert.equal(snapshot.perguntas.find((p) => p.codigo === "imp_personalizado_outro")?.metadados?.tipoCondicionante, "IMPEDIMENTO");
    assert.equal(ctx.respostas.find((r) => r.perguntaCodigo === itemPersonalizado.codigo)?.perguntaTexto, itemPersonalizado.nome);
    assert.ok(ctx.respostas.some((r) => r.perguntaCodigo === "imp_personalizado_outro"));
    const atendido = await ctx.request("/iniciativas/wizard/preview", { ...body, respostas: [...impedimentosRespondidos, { perguntaCodigo: itemPersonalizado.codigo, valor: "atendida" }, { perguntaCodigo: "imp_personalizado_outro", valor: "pendente" }] });
    assert.equal(atendido.status, 200);
    assert.ok(!atendido.json.data.bloqueios.some((b: { perguntaCodigo: string }) => b.perguntaCodigo.startsWith("imp_personalizado_")));
  });
}

test("itens personalizados rejeitam nomes vazios, codigos duplicados e alteracao de itens padrao", async (t) => {
  const ctx = await setup(t);
  for (const itens of [[{ ...itemPersonalizado, nome: " " }], [itemPersonalizado, itemPersonalizado], [{ ...itemPersonalizado, codigo: "orcamento_recursos" }]]) {
    for (const path of ["preview", "confirmar"]) {
      const response = await ctx.request(`/iniciativas/wizard/${path}`, { ...wizard, impedimentosPersonalizados: itens });
      assert.equal(response.status, 400, JSON.stringify(response.json));
    }
  }
  const semResposta = await ctx.request("/iniciativas/wizard/confirmar", { ...wizard, impedimentosPersonalizados: [itemPersonalizado] });
  assert.equal(semResposta.status, 422);
  assert.equal(semResposta.json.error.code, "IMPEDIMENTO_NAO_RESPONDIDO");
  assert.equal(ctx.transacoes.length, 0);
});
