import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GRUPOS_CONDICOES,
  buildCatalogoPerguntas,
} from "./catalog/condicoes-estruturante";
import {
  GRUPOS_PLANO,
  MODELO_PLANO_GOVERNO,
  buildPlanoGovernoPerguntas,
} from "./catalog/plano-governo";
import {
  GRUPOS_ACAO,
  MODELO_ACAO_DIARIA,
  buildAcaoDiariaPerguntas,
} from "./catalog/acao-diaria";
import { formatarDetalhes, parseCondicaoResposta } from "./condicao-resposta";
import { evaluateWizard } from "./wizard-engine";

describe("três catálogos de gestão pública", () => {
  it("estruturante exporta 4 grupos e follow-ups de verba/licença", () => {
    assert.equal(GRUPOS_CONDICOES.length, 4);
    const perguntas = buildCatalogoPerguntas();
    assert.ok(perguntas.length > 10);
    const verba = perguntas.find((p) => p.codigo === "orcamento_recursos");
    const licenca = perguntas.find((p) => p.codigo === "licencas_autorizacoes");
    assert.ok(verba?.camposFollowUp?.some((c) => c.chave === "valor_verba"));
    assert.ok(licenca?.camposFollowUp?.some((c) => c.chave === "quais_licencas"));
  });

  it("plano de governo tem segmentos compromisso→cobrança e follow-ups", () => {
    assert.equal(GRUPOS_PLANO.length, 4);
    const perguntas = buildPlanoGovernoPerguntas();
    assert.equal(perguntas.length, MODELO_PLANO_GOVERNO.perguntas.length);
    assert.ok(perguntas.some((p) => p.grupo === "compromisso"));
    assert.ok(perguntas.some((p) => p.grupo === "cobranca"));
    const recurso = perguntas.find((p) => p.codigo === "plano_recurso");
    assert.ok(recurso?.camposFollowUp?.some((c) => c.chave === "valor_verba"));
  });

  it("ação diária tem demanda operacional objetiva com follow-ups", () => {
    assert.equal(GRUPOS_ACAO.length, 4);
    const perguntas = buildAcaoDiariaPerguntas();
    assert.equal(perguntas.length, MODELO_ACAO_DIARIA.perguntas.length);
    assert.ok(perguntas.some((p) => p.codigo === "acao_demanda"));
    assert.ok(perguntas.some((p) => p.codigo === "acao_prazo_externo"));
    const prazo = perguntas.find((p) => p.codigo === "acao_prazo_externo");
    assert.ok(prazo?.camposFollowUp?.some((c) => c.chave === "dias_restantes"));
  });

  it("formatarDetalhes resume follow-ups e ignora _selecao", () => {
    const txt = formatarDetalhes(
      { valor_verba: 1500, _selecao: "Em andamento", fonte: "LOA" },
      { valor_verba: "Valor", fonte: "Fonte" },
    );
    assert.match(txt, /Valor: 1500/);
    assert.match(txt, /Fonte: LOA/);
    assert.doesNotMatch(txt, /_selecao/);
  });

  it("plano e ação avaliam etapas/prioridade sem early-return", () => {
    const plano = evaluateWizard({
      modelo: MODELO_PLANO_GOVERNO,
      classificacaoPrincipal: "PLANO_GOVERNO",
      respostas: [
        {
          perguntaCodigo: "plano_resultado",
          valor: {
            codigo: "plano_resultado",
            aplicabilidade: "sim",
            situacao: "atendida",
            detalhes: { resultado_esperado: "Ampliar vagas" },
          },
        },
      ],
    });
    assert.ok(plano.etapas.length > 0);
    assert.ok(plano.prontidaoPct !== null);

    const acao = evaluateWizard({
      modelo: MODELO_ACAO_DIARIA,
      classificacaoPrincipal: "ACAO_DIARIA",
      respostas: [
        {
          perguntaCodigo: "acao_prazo_externo",
          valor: {
            codigo: "acao_prazo_externo",
            aplicabilidade: "sim",
            situacao: "pendente",
            detalhes: { dias_restantes: 1, origem_prazo: "Ofício" },
          },
        },
      ],
    });
    assert.equal(acao.prioridade, "CRITICA");

    const parsed = parseCondicaoResposta("licitacao", {
      fechada: "pendente",
      detalhes: { _selecao: "Pregão", objeto_contratacao: "Obra" },
    });
    assert.equal(parsed.detalhes?._selecao, "Pregão");
  });
});
