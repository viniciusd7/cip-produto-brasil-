/**
 * Catálogo — Plano de Governo (compromisso → entrega → rastreio).
 * Sem checklist de obra; foco em compromisso do plano e cobrança.
 */
import type { CampoFollowUp } from "../condicao-resposta";
import type { ModeloPerguntaDef, ModeloSnapshot } from "../wizard-engine";

export const GRUPOS_PLANO = [
  {
    id: "recursos_leves",
    nome: "Recursos",
    ajuda: "Situação da verba e dependência de repasse.",
    ordem: 1,
  },
  {
    id: "cobranca",
    nome: "Acompanhamento",
    ajuda: "Próximo marco e prazo externo. Mudanças de data são registradas nas tarefas.",
    ordem: 2,
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
  opcoes?: string[];
  opcoesComDetalhes?: string[];
};

const TEMAS: TemaPlano[] = [
  {
    codigo: "plano_recurso",
    grupo: "recursos_leves",
    rotulo: "Recurso previsto",
    pergunta: "Há recurso previsto para este compromisso?",
    ajuda: "Informe se o valor está liberado, apenas previsto ou ainda não definido.",
    espera: "Aguardando recurso do compromisso",
    impacto: "CONDICIONAL",
    tipoResposta: "SELECAO",
    opcoes: ["Sim, verba liberada", "Há previsão, mas não liberada", "Ainda sem previsão", "A confirmar"],
    opcoesComDetalhes: ["Sim, verba liberada", "Há previsão, mas não liberada"],
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
    tipoResposta: "SELECAO",
    opcoes: ["Sim", "Não", "A confirmar"],
    opcoesComDetalhes: ["Sim"],
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
    ajuda: "Ex.: apresentar projeto básico até 15/04.",
    espera: "Aguardando próximo marco",
    impacto: "CONDICIONAL",
    obrigatoria: true,
    tipoResposta: "TEXTO",
  },
  {
    codigo: "plano_prazo_externo",
    grupo: "cobranca",
    rotulo: "Prazo externo",
    pergunta: "Há prazo externo (ofício, judicial ou prestação de contas)?",
    ajuda: "Registre origem, número e dias restantes.",
    espera: "Prazo externo do compromisso",
    impacto: "CONDICIONAL",
    tipoResposta: "SELECAO",
    opcoes: ["Sim", "Não", "A confirmar"],
    opcoesComDetalhes: ["Sim"],
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
        quando: { eq: "Sim" },
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
    favoraveis: t.tipoResposta === "TEXTO" ? null : t.tipoResposta === "SELECAO" ? t.codigo === "plano_recurso" ? ["Sim, verba liberada"] : ["Sim", "Não"] : ["atendida", "nao_se_aplica"],
    opcoes: t.opcoes,
    opcoesComDetalhes: t.opcoesComDetalhes,
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
