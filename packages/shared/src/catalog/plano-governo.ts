/**
 * Catálogo — Plano de Governo (compromisso → entrega → rastreio).
 * Sem checklist de obra; foco em compromisso do plano e cobrança.
 */
import type { CampoFollowUp } from "../condicao-resposta";
import type { ModeloPerguntaDef, ModeloSnapshot } from "../wizard-engine";

export const GRUPOS_PLANO = [
  {
    id: "compromisso",
    nome: "Compromisso",
    ajuda: "Vincule o projeto ao compromisso do plano e ao resultado esperado.",
    ordem: 1,
  },
  {
    id: "entrega",
    nome: "Entrega",
    ajuda: "O que será entregue neste ciclo e como medir sucesso.",
    ordem: 2,
  },
  {
    id: "recursos_leves",
    nome: "Recursos",
    ajuda: "Previsão de recurso e eventual emenda/convênio — sem checklist de obra.",
    ordem: 3,
  },
  {
    id: "cobranca",
    nome: "Cobrança",
    ajuda: "Próximo marco e riscos de atraso para a agenda do gabinete.",
    ordem: 4,
  },
] as const;

type TemaPlano = {
  codigo: string;
  grupo: (typeof GRUPOS_PLANO)[number]["id"];
  rotulo: string;
  pergunta: string;
  ajuda: string;
  espera: string;
  impacto?: ModeloPerguntaDef["impacto"];
  obrigatoria?: boolean;
  tipoResposta?: ModeloPerguntaDef["tipoResposta"];
  camposFollowUp?: CampoFollowUp[];
  efeitos?: ModeloPerguntaDef["efeitos"];
};

const TEMAS: TemaPlano[] = [
  {
    codigo: "plano_resultado",
    grupo: "compromisso",
    rotulo: "Resultado esperado",
    pergunta: "Qual resultado do plano este projeto deve concretizar?",
    ajuda: "Descreva o compromisso em linguagem de entrega (não só o nome da meta).",
    espera: "Aguardando definição do resultado",
    impacto: "BLOQUEANTE",
    obrigatoria: true,
    camposFollowUp: [
      {
        chave: "resultado_esperado",
        label: "Resultado esperado",
        tipo: "textarea",
        placeholder: "Ex.: ampliar 200 vagas escolares no Bairro Novo até dez/2026",
        obrigatorioQuando: ["pendente", "atendida"],
      },
      {
        chave: "publico_alvo",
        label: "Público-alvo",
        tipo: "texto",
        placeholder: "Quem se beneficia",
      },
    ],
  },
  {
    codigo: "plano_entrega_ciclo",
    grupo: "entrega",
    rotulo: "Entrega deste ciclo",
    pergunta: "O que será entregue neste ciclo de governo / exercício?",
    ajuda: "Seja concreto: obra, serviço, norma, sistema — com prazo.",
    espera: "Aguardando definição da entrega",
    impacto: "BLOQUEANTE",
    obrigatoria: true,
    camposFollowUp: [
      {
        chave: "entrega_ciclo",
        label: "Entrega neste ciclo",
        tipo: "textarea",
        obrigatorioQuando: ["pendente", "atendida"],
      },
      {
        chave: "prazo_entrega",
        label: "Prazo da entrega",
        tipo: "texto",
        placeholder: "Ex.: 30/11/2026 ou 2º semestre",
      },
      {
        chave: "indicador_sucesso",
        label: "Indicador de sucesso",
        tipo: "texto",
        placeholder: "Ex.: % de execução; nº de atendimentos",
      },
    ],
  },
  {
    codigo: "plano_recurso",
    grupo: "recursos_leves",
    rotulo: "Recurso previsto",
    pergunta: "Há recurso previsto para este compromisso?",
    ajuda: "Informe valor e fonte quando houver previsão.",
    espera: "Aguardando recurso do compromisso",
    impacto: "CONDICIONAL",
    camposFollowUp: [
      { chave: "valor_verba", label: "Valor previsto (R$)", tipo: "moeda" },
      { chave: "fonte_confirmada", label: "Fonte", tipo: "texto" },
    ],
  },
  {
    codigo: "plano_emenda_convenio",
    grupo: "recursos_leves",
    rotulo: "Emenda ou convênio",
    pergunta: "Depende de emenda parlamentar ou convênio/repasse?",
    ajuda: "Se sim, registre o número do instrumento (Transferegov / emenda).",
    espera: "Aguardando emenda ou convênio",
    impacto: "CONDICIONAL",
    camposFollowUp: [
      {
        chave: "instrumento",
        label: "Nº do instrumento / emenda",
        tipo: "texto",
        placeholder: "Nº Transferegov ou emenda",
      },
    ],
  },
  {
    codigo: "plano_proximo_marco",
    grupo: "cobranca",
    rotulo: "Próximo marco",
    pergunta: "Qual é o próximo marco cobrável deste compromisso?",
    ajuda: "Um marco claro para a agenda do gabinete.",
    espera: "Aguardando próximo marco",
    impacto: "CONDICIONAL",
    camposFollowUp: [
      {
        chave: "proximo_marco",
        label: "Próximo marco",
        tipo: "textarea",
        placeholder: "Ex.: protocolar projeto básico até 15/04",
        obrigatorioQuando: ["pendente", "atendida"],
      },
    ],
  },
  {
    codigo: "plano_risco_atraso",
    grupo: "cobranca",
    rotulo: "Risco de atraso",
    pergunta: "Há risco concreto de atraso neste compromisso?",
    ajuda: "Se sim, registre a causa (verba, licença, licitação, equipe…).",
    espera: "Aguardando mitigação de atraso",
    impacto: "CONDICIONAL",
    camposFollowUp: [
      {
        chave: "causa_atraso",
        label: "Causa do risco de atraso",
        tipo: "textarea",
        placeholder: "Ex.: convênio não formalizado; falta de projeto",
      },
    ],
    efeitos: [
      {
        quando: { in: ["pendente", "atendida"] },
        elevaPrioridade: "ALTA",
        motivoPrioridade: "Risco de atraso no compromisso do plano",
      },
    ],
  },
  {
    codigo: "plano_prazo_externo",
    grupo: "cobranca",
    rotulo: "Prazo externo",
    pergunta: "Há prazo externo (ofício, judicial ou prestação de contas)?",
    ajuda: "Registre origem, número e dias restantes.",
    espera: "Prazo externo do compromisso",
    impacto: "CONDICIONAL",
    camposFollowUp: [
      {
        chave: "origem_prazo",
        label: "Origem do prazo",
        tipo: "texto",
        placeholder: "Ofício, decisão judicial, prestação de contas…",
      },
      { chave: "numero_documento", label: "Nº do documento", tipo: "texto" },
      { chave: "dias_restantes", label: "Dias restantes", tipo: "numero" },
    ],
    efeitos: [
      {
        quando: { in: ["pendente", "atendida"] },
        elevaPrioridade: "ALTA",
        motivoPrioridade: "Prazo externo no compromisso do plano",
      },
    ],
  },
];

function toPergunta(t: TemaPlano, ordem: number): ModeloPerguntaDef {
  const g = GRUPOS_PLANO.find((x) => x.id === t.grupo)!;
  return {
    codigo: t.codigo,
    texto: t.pergunta,
    rotulo: t.rotulo,
    pergunta: t.pergunta,
    tipoResposta: t.tipoResposta || "CONDICAO_FECHADA",
    impacto: t.impacto || "CONDICIONAL",
    obrigatoria: t.obrigatoria,
    ordem,
    ajuda: t.ajuda,
    espera: t.espera,
    grupo: t.grupo,
    etapa: g.ordem,
    favoraveis: ["atendida", "nao_se_aplica"],
    camposFollowUp: t.camposFollowUp ?? null,
    efeitos: t.efeitos,
  };
}

export function buildPlanoGovernoPerguntas(): ModeloPerguntaDef[] {
  return TEMAS.map((t, i) => toPergunta(t, i + 1));
}

export const MODELO_PLANO_GOVERNO: ModeloSnapshot = {
  codigo: "PLANO_GOVERNO_PADRAO",
  nome: "Plano de Governo (padrão CIP)",
  perguntas: buildPlanoGovernoPerguntas(),
  estrutura: [],
  etapas: GRUPOS_PLANO.map((g) => ({
    ordem: g.ordem,
    codigo: g.id.toUpperCase(),
    nome: g.nome,
    descricao: g.ajuda,
  })),
};
