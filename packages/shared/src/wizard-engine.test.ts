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
    assert.ok(result.estrutura.some((n) => n.codigo === "META_OBRA"));
  });

  it("condicional positiva inclui meta de desapropriação", () => {
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
    const des = result.estrutura.find((n) => n.codigo === "META_DESAPROPRIACAO");
    assert.ok(des);
    assert.equal(des?.children.length, 2);
    assert.equal(des?.origemPerguntaCodigo, "DESAPROPRIACAO");
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
    const meta = result.estrutura.find((n) => n.codigo === "META_PLANEJAMENTO");
    assert.ok(meta?.children.some((c) => c.codigo === "TAR_OBTER_DOTACAO"));
  });
});
