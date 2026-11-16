import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluateWizard,
  reavaliarRespostas,
  visibleQuestions,
  type ModeloSnapshot,
} from "./wizard-engine";

const ubsModelo: ModeloSnapshot = {
  codigo: "UBS_CONSTRUCAO",
  nome: "Construção de UBS",
  perguntas: [
    {
      codigo: "ORCAMENTO_LIBERADO",
      texto: "O orçamento foi liberado?",
      tipoResposta: "SIM_NAO",
      impacto: "BLOQUEANTE",
      obrigatoria: true,
      ordem: 1,
      efeitos: [
        {
          quando: { neq: "SIM" },
          ciclo: "AGUARDANDO_PRE_REQUISITO",
          rotuloBloqueio: "Aguardando verba",
          alertaResponsavel: true,
        },
      ],
    },
    {
      codigo: "DESAPROPRIACAO",
      texto: "Possui desapropriação?",
      tipoResposta: "SIM_NAO",
      impacto: "CONDICIONAL",
      ordem: 2,
      efeitos: [
        {
          quando: { eq: "SIM" },
          incluirEstrutura: ["META_DESAPROPRIACAO", "TAR_LAUDO", "TAR_DECRETO"],
        },
      ],
    },
    {
      codigo: "VALOR_DESAPROPRIACAO",
      texto: "Valor estimado da desapropriação",
      tipoResposta: "NUMERO",
      impacto: "INFORMATIVA",
      ordem: 3,
      dependeDeCodigo: "DESAPROPRIACAO",
      dependeDeValor: { eq: "SIM" },
    },
    {
      codigo: "TERRENO_MUNICIPIO",
      texto: "Terreno já é do município?",
      tipoResposta: "SIM_NAO",
      impacto: "CONDICIONAL",
      ordem: 4,
      efeitos: [
        {
          quando: { eq: "NAO" },
          incluirEstrutura: ["TAR_REGULARIZACAO"],
        },
      ],
    },
  ],
  estrutura: [
    {
      codigo: "META_OBRA",
      nivel: "META",
      nome: "Execução da obra da UBS",
      indicador: "% de avanço físico",
      alvo: "100%",
      ordem: 1,
      sempreIncluir: true,
    },
    {
      codigo: "TAR_LICITACAO",
      nivel: "TAREFA",
      parentCodigo: "META_OBRA",
      nome: "Conduzir licitação",
      ordem: 1,
      sempreIncluir: true,
    },
    {
      codigo: "META_DESAPROPRIACAO",
      nivel: "META",
      nome: "Processo de desapropriação",
      indicador: "Etapas concluídas",
      alvo: "4/4",
      ordem: 2,
      sempreIncluir: false,
    },
    {
      codigo: "TAR_LAUDO",
      nivel: "TAREFA",
      parentCodigo: "META_DESAPROPRIACAO",
      nome: "Laudo de avaliação",
      ordem: 1,
      sempreIncluir: false,
    },
    {
      codigo: "TAR_DECRETO",
      nivel: "TAREFA",
      parentCodigo: "META_DESAPROPRIACAO",
      nome: "Decreto de utilidade pública",
      ordem: 2,
      sempreIncluir: false,
    },
    {
      codigo: "TAR_REGULARIZACAO",
      nivel: "TAREFA",
      parentCodigo: "META_OBRA",
      nome: "Regularização fundiária",
      ordem: 2,
      sempreIncluir: false,
    },
  ],
};

describe("wizard-engine", () => {
  it("bloqueante negativa gera ciclo e rótulo Aguardando verba", () => {
    const result = evaluateWizard({
      modelo: ubsModelo,
      classificacaoPrincipal: "ESTRUTURANTE",
      respostas: [
        { perguntaCodigo: "ORCAMENTO_LIBERADO", valor: "NAO" },
        { perguntaCodigo: "DESAPROPRIACAO", valor: "NAO" },
        { perguntaCodigo: "TERRENO_MUNICIPIO", valor: "SIM" },
      ],
    });
    assert.equal(result.cicloInicial, "AGUARDANDO_PRE_REQUISITO");
    assert.equal(result.bloqueioLabel, "Aguardando verba");
    assert.equal(result.bloqueios[0]?.perguntaCodigo, "ORCAMENTO_LIBERADO");
    const tarefaObra = result.estrutura.find((n) => n.codigo === "TAR_LICITACAO");
    assert.equal(tarefaObra?.nivel, "TAREFA");
    assert.equal(result.estrutura.some((n) => n.codigo === "META_OBRA"), false);
    assert.equal("indicador" in (tarefaObra ?? {}), false);
    assert.equal("alvo" in (tarefaObra ?? {}), false);
  });

  it("condicional positiva remove agrupamento legado e promove tarefas-filhas", () => {
    const result = evaluateWizard({
      modelo: ubsModelo,
      classificacaoPrincipal: "ESTRUTURANTE",
      respostas: [
        { perguntaCodigo: "ORCAMENTO_LIBERADO", valor: "SIM" },
        { perguntaCodigo: "DESAPROPRIACAO", valor: "SIM" },
        { perguntaCodigo: "TERRENO_MUNICIPIO", valor: "SIM" },
      ],
    });
    assert.equal(result.cicloInicial, "EM_PLANEJAMENTO");
    const tarefasDesapropriacao = result.estrutura.filter((n) =>
      ["TAR_LAUDO", "TAR_DECRETO"].includes(n.codigo),
    );
    assert.equal(tarefasDesapropriacao.length, 2);
    assert.ok(tarefasDesapropriacao.every((n) => n.nivel === "TAREFA"));
    assert.equal(
      result.estrutura.some((n) => n.codigo === "META_DESAPROPRIACAO"),
      false,
    );
    assert.ok(tarefasDesapropriacao.every((n) => n.origemPerguntaCodigo === "DESAPROPRIACAO"));
  });

  it("dependência: valor desapropriação só visível se SIM", () => {
    const hidden = visibleQuestions(ubsModelo.perguntas, [
      { perguntaCodigo: "DESAPROPRIACAO", valor: "NAO" },
    ]);
    assert.ok(!hidden.some((p) => p.codigo === "VALOR_DESAPROPRIACAO"));

    const shown = visibleQuestions(ubsModelo.perguntas, [
      { perguntaCodigo: "DESAPROPRIACAO", valor: "SIM" },
    ]);
    assert.ok(shown.some((p) => p.codigo === "VALOR_DESAPROPRIACAO"));
  });

  it("reavaliação libera bloqueio quando verba liberada", () => {
    const blocked = evaluateWizard({
      modelo: ubsModelo,
      classificacaoPrincipal: "ESTRUTURANTE",
      respostas: [{ perguntaCodigo: "ORCAMENTO_LIBERADO", valor: "NAO" }],
    });
    assert.equal(blocked.cicloInicial, "AGUARDANDO_PRE_REQUISITO");

    const free = reavaliarRespostas({
      modelo: ubsModelo,
      classificacaoPrincipal: "ESTRUTURANTE",
      respostas: [
        { perguntaCodigo: "ORCAMENTO_LIBERADO", valor: "SIM" },
        { perguntaCodigo: "DESAPROPRIACAO", valor: "NAO" },
        { perguntaCodigo: "TERRENO_MUNICIPIO", valor: "SIM" },
      ],
    });
    assert.equal(free.cicloInicial, "EM_PLANEJAMENTO");
    assert.equal(free.bloqueioLabel, null);
  });

  it("CONDICAO_FECHADA bloqueante pendente gera espera e inclui estrutura", () => {
    const modelo: ModeloSnapshot = {
      codigo: "P03",
      nome: "P03",
      etapas: [{ ordem: 2, codigo: "RECURSOS", nome: "Recursos" }],
      perguntas: [
        {
          codigo: "orcamento_recursos",
          texto: "Previsão orçamentária conferida?",
          rotulo: "Previsão orçamentária",
          espera: "Aguardando verba",
          tipoResposta: "CONDICAO_FECHADA",
          impacto: "BLOQUEANTE",
          obrigatoria: true,
          ordem: 1,
          etapa: 2,
          favoraveis: ["atendida", "nao_se_aplica"],
          efeitos: [
            {
              quando: { in: ["pendente", "a_avaliar"] },
              ciclo: "AGUARDANDO_PRE_REQUISITO",
              rotuloBloqueio: "Aguardando verba",
              incluirEstrutura: ["TAR_OBTER_DOTACAO"],
            },
          ],
        },
      ],
      estrutura: [
        {
          codigo: "META_PLANEJAMENTO",
          nivel: "META",
          nome: "Enquadramento",
          ordem: 1,
          sempreIncluir: true,
        },
        {
          codigo: "TAR_OBTER_DOTACAO",
          nivel: "TAREFA",
          parentCodigo: "META_PLANEJAMENTO",
          nome: "Obter dotação",
          ordem: 1,
        },
      ],
    };

    const result = evaluateWizard({
      modelo,
      classificacaoPrincipal: "ESTRUTURANTE",
      respostas: [
        {
          perguntaCodigo: "orcamento_recursos",
          valor: {
            codigo: "orcamento_recursos",
            aplicabilidade: "sim",
            situacao: "pendente",
            proximoPasso: "Pedir empenho",
          },
        },
      ],
    });
    assert.equal(result.cicloInicial, "AGUARDANDO_PRE_REQUISITO");
    assert.equal(result.bloqueioLabel, "Aguardando verba");
    const tarefa = result.estrutura.find((n) => n.codigo === "TAR_OBTER_DOTACAO");
    assert.equal(tarefa?.nivel, "TAREFA");
    assert.equal(result.estrutura.some((n) => n.codigo === "META_PLANEJAMENTO"), false);
  });

  it("estrutura nativa de projeto mantém tarefas e subtarefas sem níveis extras", () => {
    const modelo: ModeloSnapshot = {
      codigo: "PROJETO_TAREFAS",
      nome: "Projeto com tarefas",
      perguntas: [],
      estrutura: [
        {
          codigo: "TAR_ENTREGA",
          nivel: "TAREFA",
          nome: "Entregar serviço",
          ordem: 1,
          sempreIncluir: true,
        },
        {
          codigo: "SUB_PREPARAR",
          nivel: "SUBTAREFA",
          parentCodigo: "TAR_ENTREGA",
          nome: "Preparar atendimento",
          ordem: 1,
          sempreIncluir: true,
        },
      ],
    };

    const result = evaluateWizard({
      modelo,
      classificacaoPrincipal: "ESTRUTURANTE",
      respostas: [],
    });

    assert.deepEqual(
      result.estrutura.map(({ codigo, nivel, children }) => ({
        codigo,
        nivel,
        children: children.map(({ codigo: childCodigo, nivel: childNivel }) => ({
          codigo: childCodigo,
          nivel: childNivel,
        })),
      })),
      [{
        codigo: "TAR_ENTREGA",
        nivel: "TAREFA",
        children: [{ codigo: "SUB_PREPARAR", nivel: "SUBTAREFA" }],
      }],
    );
  });

  it("preserva itens descendentes de snapshots legados sem gerar terceiro nível", () => {
    const modelo: ModeloSnapshot = {
      codigo: "PROJETO_LEGADO",
      nome: "Projeto legado",
      perguntas: [
        {
          codigo: "INCLUIR_TAREFA",
          texto: "Incluir tarefas",
          tipoResposta: "SIM_NAO",
          impacto: "CONDICIONAL",
          ordem: 1,
          efeitos: [
            {
              quando: { eq: "SIM" },
              incluirEstrutura: ["TAR_LEGADA", "SUB_LEGADA", "SUB_NETA"],
            },
          ],
        },
      ],
      estrutura: [
        {
          codigo: "META_LEGADA",
          nivel: "META",
          nome: "Grupo legado",
          indicador: "Não deve ser emitido",
          alvo: "1",
          ordem: 1,
          sempreIncluir: true,
        },
        {
          codigo: "TAR_LEGADA",
          nivel: "TAREFA",
          parentCodigo: "META_LEGADA",
          nome: "Tarefa existente",
          responsavel: "Equipe de obras",
          prazo: "2026-12-10T12:00:00.000Z",
          ordem: 1,
        },
        {
          codigo: "SUB_LEGADA",
          nivel: "SUBTAREFA",
          parentCodigo: "TAR_LEGADA",
          nome: "Subtarefa existente",
          responsavel: "Ana",
          prazo: "2026-12-05T12:00:00.000Z",
          ordem: 1,
        },
        {
          codigo: "SUB_NETA",
          nivel: "SUBTAREFA",
          parentCodigo: "SUB_LEGADA",
          nome: "Subtarefa aninhada no legado",
          responsavel: "Bruno",
          prazo: "2026-12-06T12:00:00.000Z",
          ordem: 1,
        },
        {
          codigo: "SUB_NAO_SELECIONADA",
          nivel: "SUBTAREFA",
          parentCodigo: "TAR_LEGADA",
          nome: "Subtarefa não selecionada",
          ordem: 2,
        },
      ],
    };

    const result = evaluateWizard({
      modelo,
      classificacaoPrincipal: "ESTRUTURANTE",
      respostas: [{ perguntaCodigo: "INCLUIR_TAREFA", valor: "SIM" }],
    });

    assert.deepEqual(result.estrutura.map(({ codigo, nivel }) => ({ codigo, nivel })), [
      { codigo: "TAR_LEGADA", nivel: "TAREFA" },
    ]);
    assert.deepEqual(
      result.estrutura[0]?.children.map(({ codigo, nivel, nome, responsavel, prazo, children }) => ({
        codigo,
        nivel,
        nome,
        responsavel,
        prazo,
        children: children.length,
      })),
      [
        {
          codigo: "SUB_LEGADA",
          nivel: "SUBTAREFA",
          nome: "Subtarefa existente",
          responsavel: "Ana",
          prazo: "2026-12-05T12:00:00.000Z",
          children: 0,
        },
        {
          codigo: "SUB_NETA",
          nivel: "SUBTAREFA",
          nome: "Subtarefa aninhada no legado",
          responsavel: "Bruno",
          prazo: "2026-12-06T12:00:00.000Z",
          children: 0,
        },
      ],
    );
    assert.equal(result.estrutura[0]?.responsavel, "Equipe de obras");
    assert.equal(result.estrutura[0]?.prazo, "2026-12-10T12:00:00.000Z");
    assert.ok(result.estrutura.every((n) => n.origemPerguntaCodigo === "INCLUIR_TAREFA"));
    assert.ok(
      result.estrutura[0]?.children.every(
        (n) => n.origemPerguntaCodigo === "INCLUIR_TAREFA",
      ),
    );
    assert.equal(result.estrutura.some((n) => n.codigo === "META_LEGADA"), false);
    assert.equal(
      result.estrutura[0]?.children.some((n) => n.codigo === "SUB_NAO_SELECIONADA"),
      false,
    );
  });

  it("descarta META legada sem promover filhos TAREFA não selecionados", () => {
    const result = evaluateWizard({
      modelo: {
        codigo: "PROJETO_META_AGRUPADORA",
        nome: "Projeto com agrupador legado",
        perguntas: [],
        estrutura: [
          {
            codigo: "META_LEGADA",
            nivel: "META",
            nome: "Agrupador legado",
            ordem: 1,
            sempreIncluir: true,
          },
          {
            codigo: "TAR_CONDICIONAL",
            nivel: "TAREFA",
            parentCodigo: "META_LEGADA",
            nome: "Tarefa condicional",
            ordem: 1,
          },
        ],
      },
      classificacaoPrincipal: "ESTRUTURANTE",
      respostas: [],
    });

    assert.deepEqual(result.estrutura, []);
  });
});
