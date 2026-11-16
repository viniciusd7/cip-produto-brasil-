import type { ModeloSnapshot } from "../wizard-engine";

const gates = [
  {
    codigo: "G0",
    nome: "G0 · Decisão e governança",
    descricao: "Demanda, alternativa, oferta e autoridades locais a confirmar.",
  },
  {
    codigo: "G1",
    nome: "G1 · Planejamento e prontidão",
    descricao: "Infraestrutura, acessibilidade, equipe, recursos e contingência.",
  },
  {
    codigo: "G2",
    nome: "G2 · Retaguarda e continuidade",
    descricao: "Referência assistencial, resultados, retornos e registro oficial.",
  },
  {
    codigo: "G3",
    nome: "G3 · Agenda e comunicação",
    descricao: "Fonte oficial, contato acessível, cancelamentos e treinamento.",
  },
  {
    codigo: "G4",
    nome: "G4 · Reconciliação e encerramento",
    descricao: "Produção, seguimento, custos e relatório de avaliação.",
  },
] as const;

export const MODELO_CARRETAS_SAUDE: ModeloSnapshot = {
  codigo: "CARRETAS_SAUDE_SUS",
  nome: "Carretas da Saúde SUS · gestão administrativa",
  etapas: gates.map((gate, index) => ({
    ordem: index + 1,
    codigo: gate.codigo,
    nome: gate.nome,
    descricao: gate.descricao,
  })),
  perguntas: gates.map((gate, index) => ({
    codigo: `gate_${gate.codigo.toLowerCase()}`,
    texto: gate.nome,
    rotulo: gate.nome,
    pergunta: `Registre a situação administrativa do ${gate.codigo}.`,
    ajuda:
      `${gate.descricao} Registre apenas informação confirmada e sua fonte. ` +
      "A decisão e a autoridade são locais; este registro não autoriza atendimento.",
    tipoResposta: "CONDICAO_FECHADA",
    impacto: "INFORMATIVA",
    obrigatoria: false,
    ordem: index + 1,
    etapa: index + 1,
    grupo: gate.codigo.toLowerCase(),
    camposFollowUp: [
      {
        chave: "responsavel",
        label: "Responsável funcional designado",
        tipo: "texto",
        placeholder: "A definir, se ainda não designado",
      },
      {
        chave: "fonte",
        label: "Fonte ou documento de referência",
        tipo: "texto",
        placeholder: "Ato, documento ou sistema oficial; se desconhecido, deixe em branco",
      },
      {
        chave: "pendencia",
        label: "Pendência e próxima providência",
        tipo: "textarea",
        obrigatorioQuando: ["pendente"],
        placeholder: "Descreva somente a pendência conhecida",
      },
    ],
  })),
  estrutura: [
    {
      codigo: "META_CARRETAS_SAUDE",
      nivel: "META",
      nome: "Planejar e avaliar a iniciativa de unidade móvel",
      indicador: null,
      alvo: null,
      ordem: 1,
      sempreIncluir: true,
    },
    ...gates.map((gate, index) => ({
      codigo: `TAREFA_${gate.codigo}`,
      nivel: "TAREFA" as const,
      parentCodigo: "META_CARRETAS_SAUDE",
      nome: gate.nome,
      indicador: "Situação, responsável, fonte e pendências registrados",
      alvo: null,
      ordem: index + 1,
      sempreIncluir: true,
    })),
  ],
};

export const GRUPOS_CARRETAS_SAUDE = gates.map((gate, index) => ({
  id: gate.codigo.toLowerCase(),
  nome: gate.nome,
  ajuda: gate.descricao,
  ordem: index + 1,
}));
