/**
 * Catálogo — Ação diária (demanda operacional objetiva).
 */
import type { CampoFollowUp } from "../condicao-resposta";
import type { ModeloPerguntaDef, ModeloSnapshot } from "../wizard-engine";

export const GRUPOS_ACAO = [
  {
    id: "demanda",
    nome: "Demanda",
    ajuda: "O que precisa ser feito agora e onde.",
    ordem: 1,
  },
  {
    id: "servico",
    nome: "Serviço",
    ajuda: "Impacto no atendimento ao cidadão.",
    ordem: 2,
  },
  {
    id: "prazo",
    nome: "Prazo",
    ajuda: "Prazos externos com documento e dias.",
    ordem: 3,
  },
  {
    id: "providencia",
    nome: "Providência",
    ajuda: "Próximo passo concreto e quem executa.",
    ordem: 4,
  },
] as const;

type TemaAcao = {
  codigo: string;
  grupo: (typeof GRUPOS_ACAO)[number]["id"];
  rotulo: string;
  pergunta: string;
  ajuda: string;
  espera: string;
  impacto?: ModeloPerguntaDef["impacto"];
  obrigatoria?: boolean;
  camposFollowUp?: CampoFollowUp[];
  efeitos?: ModeloPerguntaDef["efeitos"];
};

const TEMAS: TemaAcao[] = [
  {
    codigo: "acao_demanda",
    grupo: "demanda",
    rotulo: "Demanda imediata",
    pergunta: "O que precisa ser feito agora nesta ação?",
    ajuda: "Descreva a demanda em uma frase operacional.",
    espera: "Aguardando descrição da demanda",
    impacto: "BLOQUEANTE",
    obrigatoria: true,
    camposFollowUp: [
      {
        chave: "o_que_fazer",
        label: "O que precisa ser feito agora",
        tipo: "textarea",
        placeholder: "Ex.: religar o gerador da UBS do bairro Centro",
        obrigatorioQuando: ["pendente", "atendida"],
      },
      {
        chave: "onde_unidade",
        label: "Onde / unidade",
        tipo: "texto",
        placeholder: "Escola, UBS, secretaria, bairro…",
      },
    ],
  },
  {
    codigo: "acao_impede_servico",
    grupo: "servico",
    rotulo: "Atendimento ao cidadão",
    pergunta: "Esta ação impede ou reduz atendimento ao cidadão agora?",
    ajuda: "Se sim, diga qual serviço e quantas pessoas/dia são afetadas.",
    espera: "Serviço ao cidadão impactado",
    impacto: "CONDICIONAL",
    camposFollowUp: [
      {
        chave: "qual_servico",
        label: "Qual serviço é afetado?",
        tipo: "texto",
        placeholder: "Ex.: consulta médica, transporte escolar",
      },
      {
        chave: "pessoas_dia",
        label: "Pessoas afetadas por dia (estimativa)",
        tipo: "numero",
      },
    ],
    efeitos: [
      {
        quando: { in: ["pendente", "atendida"] },
        elevaPrioridade: "ALTA",
        motivoPrioridade: "Impede ou reduz atendimento ao cidadão",
      },
      {
        quando: { in: ["pendente", "atendida"] },
        detalhe: { chave: "pessoas_dia", gte: 500 },
        elevaPrioridade: "ALTA",
        motivoPrioridade: "Centenas de pessoas afetadas por dia",
      },
    ],
  },
  {
    codigo: "acao_prazo_externo",
    grupo: "prazo",
    rotulo: "Prazo externo",
    pergunta: "Há prazo externo (ofício, judicial, pagamento ou prestação de contas)?",
    ajuda: "Informe origem, número e dias restantes.",
    espera: "Prazo externo da ação",
    impacto: "CONDICIONAL",
    camposFollowUp: [
      {
        chave: "origem_prazo",
        label: "Origem",
        tipo: "texto",
        placeholder: "Ofício, judicial, pagamento, contas…",
      },
      { chave: "numero_documento", label: "Nº do documento", tipo: "texto" },
      { chave: "dias_restantes", label: "Dias restantes", tipo: "numero" },
    ],
    efeitos: [
      {
        quando: { in: ["pendente", "atendida"] },
        detalhe: { chave: "dias_restantes", lte: 2 },
        elevaPrioridade: "CRITICA",
        motivoPrioridade: "Prazo externo de até 2 dias",
      },
      {
        quando: { in: ["pendente", "atendida"] },
        detalhe: { chave: "dias_restantes", lte: 7 },
        elevaPrioridade: "ALTA",
        motivoPrioridade: "Prazo externo de até 7 dias",
      },
      {
        quando: { in: ["pendente", "atendida"] },
        elevaPrioridade: "ALTA",
        motivoPrioridade: "Prazo externo vinculado à ação",
      },
    ],
  },
  {
    codigo: "acao_providencia",
    grupo: "providencia",
    rotulo: "Próxima providência",
    pergunta: "Qual é o próximo passo concreto desta ação?",
    ajuda: "Quem executa e o que fará em seguida.",
    espera: "Aguardando providência",
    impacto: "CONDICIONAL",
    obrigatoria: true,
    camposFollowUp: [
      {
        chave: "proximo_passo",
        label: "Próximo passo concreto",
        tipo: "textarea",
        placeholder: "Ex.: solicitar orçamento à manutenção até sexta",
        obrigatorioQuando: ["pendente", "atendida"],
      },
      {
        chave: "quem_executa",
        label: "Quem executa",
        tipo: "texto",
        placeholder: "Nome ou área",
      },
    ],
  },
];

function toPergunta(t: TemaAcao, ordem: number): ModeloPerguntaDef {
  const g = GRUPOS_ACAO.find((x) => x.id === t.grupo)!;
  return {
    codigo: t.codigo,
    texto: t.pergunta,
    rotulo: t.rotulo,
    pergunta: t.pergunta,
    tipoResposta: "CONDICAO_FECHADA",
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

export function buildAcaoDiariaPerguntas(): ModeloPerguntaDef[] {
  return TEMAS.map((t, i) => toPergunta(t, i + 1));
}

export const MODELO_ACAO_DIARIA: ModeloSnapshot = {
  codigo: "ACAO_DIARIA_PADRAO",
  nome: "Ação diária (padrão CIP)",
  perguntas: buildAcaoDiariaPerguntas(),
  estrutura: [],
  etapas: GRUPOS_ACAO.map((g) => ({
    ordem: g.ordem,
    codigo: g.id.toUpperCase(),
    nome: g.nome,
    descricao: g.ajuda,
  })),
};
