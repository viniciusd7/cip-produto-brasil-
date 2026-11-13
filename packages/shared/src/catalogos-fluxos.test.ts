import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GRUPOS_CONDICOES,
  etapasFromGrupos,
  buildCatalogoPerguntas,
  quizItem,
} from "./catalog/condicoes-estruturante";
import {
  adicionarImpedimentosComuns,
  GRUPO_IMPEDIMENTOS,
} from "./catalog/impedimentos-comuns";
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
  it("estruturante pergunta uma vez por decisão necessária", () => {
    assert.equal(GRUPOS_CONDICOES.length, 2);
    assert.deepEqual(
      GRUPOS_CONDICOES.map((grupo) => grupo.nome),
      ["O que falta para começar", "Após a entrega"],
    );
    assert.equal(etapasFromGrupos().some((etapa) => etapa.nome === "Verba"), false);
    const perguntas = buildCatalogoPerguntas();
    assert.equal(perguntas.length, 7);
    assert.equal(new Set(perguntas.map((p) => p.codigo)).size, perguntas.length);
    assert.equal(perguntas.some((p) => p.codigo === "orcamento_recursos"), false);
    const fluxoComImpedimentos = adicionarImpedimentosComuns({
      codigo: "PROJETO_ESTRUTURANTE_PADRAO",
      nome: "Projeto estruturante",
      perguntas: [
        ...perguntas,
        {
          codigo: "orcamento_recursos",
          texto: "A verba para iniciar o projeto já está liberada?",
          tipoResposta: "SELECAO",
          impacto: "CONDICIONAL",
          ordem: 1,
          grupo: "recursos",
          etapa: 1,
          opcoes: ["Sim", "Não"],
        },
      ],
      estrutura: [],
    });
    const verba = fluxoComImpedimentos.perguntas.find(
      (p) => p.codigo === "orcamento_recursos",
    );
    const licenca = perguntas.find((p) => p.codigo === "licencas_autorizacoes");
    const licitacao = perguntas.find((p) => p.codigo === "licitacao_contratacao");
    assert.equal(verba?.grupo, GRUPO_IMPEDIMENTOS.id);
    assert.equal(verba?.tipoResposta, "CONDICAO_FECHADA");
    assert.match(verba?.texto || "", /previsão ou dotação orçamentária/);
    assert.ok(verba?.camposFollowUp?.some((c) => c.chave === "valor_verba"));
    assert.equal(quizItem("orcamento_recursos")?.grupo, GRUPO_IMPEDIMENTOS.id);
    assert.ok(
      verba?.efeitos?.some(
        (efeito) => efeito.rotuloBloqueio === "Aguardando orçamento",
      ),
    );
    assert.ok(licenca?.camposFollowUp?.some((c) => c.chave === "quais_licencas"));
    assert.match(licitacao?.texto || "", /licitar/);
    assert.ok(!perguntas.some((p) => p.codigo === "dotacao_loa" || p.codigo === "modalidade_licitacao"));
  });

  it("plano de governo tem segmentos compromisso→cobrança e follow-ups", () => {
    assert.equal(GRUPOS_PLANO.length, 2);
    const perguntas = buildPlanoGovernoPerguntas();
    assert.equal(perguntas.length, MODELO_PLANO_GOVERNO.perguntas.length);
    assert.ok(perguntas.some((p) => p.grupo === "recursos_leves"));
    assert.ok(perguntas.some((p) => p.grupo === "cobranca"));
    assert.ok(!perguntas.some((p) => p.codigo === "plano_resultado" || p.codigo === "plano_entrega_ciclo"));
    const recurso = perguntas.find((p) => p.codigo === "plano_recurso");
    assert.ok(recurso?.camposFollowUp?.some((c) => c.chave === "valor_verba"));
  });

  it("ação diária tem demanda operacional objetiva com follow-ups", () => {
    assert.equal(GRUPOS_ACAO.length, 3);
    const perguntas = buildAcaoDiariaPerguntas();
    assert.equal(perguntas.length, MODELO_ACAO_DIARIA.perguntas.length);
    assert.ok(!perguntas.some((p) => p.codigo === "acao_demanda"));
    assert.equal(perguntas.find((p) => p.codigo === "acao_providencia")?.tipoResposta, "TEXTO");
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
          perguntaCodigo: "plano_proximo_marco",
          valor: "Abrir novas vagas até dezembro",
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
            detalhes: { _selecao: "Sim", dias_restantes: 1, origem_prazo: "Ofício" },
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

  it("orçamento pendente como impedimento gera bloqueio e tarefa de dotação", () => {
    const modelo = {
      codigo: "PROJETO_ESTRUTURANTE_PADRAO",
      nome: "Projeto",
      perguntas: adicionarImpedimentosComuns({
        codigo: "PROJETO_ESTRUTURANTE_PADRAO",
        nome: "Projeto",
        perguntas: buildCatalogoPerguntas(),
        estrutura: [],
      }).perguntas,
      etapas: [],
      estrutura: [
        { codigo: "META_PLANEJAMENTO", nivel: "META" as const, nome: "Recursos", ordem: 1 },
        { codigo: "TAR_OBTER_DOTACAO", nivel: "TAREFA" as const, parentCodigo: "META_PLANEJAMENTO", nome: "Obter dotação", ordem: 1 },
      ],
    };
    const valor = { codigo: "orcamento_recursos", aplicabilidade: "sim" as const, situacao: "pendente" as const, detalhes: { valor_verba: 100 } };
    const resultado = evaluateWizard({ modelo, classificacaoPrincipal: "ESTRUTURANTE", respostas: [{ perguntaCodigo: "orcamento_recursos", valor }] });
    assert.equal(resultado.bloqueioLabel, "Aguardando orçamento");
    assert.ok(resultado.estrutura[0]?.children.some((n) => n.codigo === "TAR_OBTER_DOTACAO"));
  });
});
