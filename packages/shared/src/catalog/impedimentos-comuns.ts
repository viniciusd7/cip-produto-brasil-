import type { ModeloSnapshot, ModeloPerguntaDef } from "../wizard-engine";

export const GRUPO_IMPEDIMENTOS = {
  id: "impedimentos",
  nome: "Impedimentos e pré-requisitos",
  ajuda: "Identifique cedo o que pode exigir providência para este projeto.",
  ordem: 0,
} as const;

const EFEITO_PRIORIDADE_APLICAVEL: NonNullable<
  ModeloPerguntaDef["efeitos"]
>[number] = {
  quando: { in: ["a_avaliar", "pendente", "atendida"] },
  quandoAplicabilidade: "sim",
  elevaPrioridade: "ALTA",
  motivoPrioridade: "Há um impedimento ou pré-requisito aplicável ao projeto",
};

const EFEITO_ORCAMENTO_PENDENTE: NonNullable<
  ModeloPerguntaDef["efeitos"]
>[number] = {
  quando: { eq: "pendente" },
  quandoAplicabilidade: "sim",
  ciclo: "AGUARDANDO_PRE_REQUISITO",
  rotuloBloqueio: "Aguardando orçamento",
  alertaResponsavel: true,
  incluirEstrutura: ["TAR_OBTER_DOTACAO"],
};

export const CODIGOS_IMPEDIMENTOS_COMUNS = [
  "licitacao_contratacao",
  "orcamento_recursos",
  "desapropriacao_imovel",
  "necessidade_pl",
  "outro_impedimento",
] as const;

export const PERGUNTAS_IMPEDIMENTOS_COMUNS: ModeloPerguntaDef[] = [
  {
    codigo: "licitacao_contratacao",
    texto: "Será necessário licitar ou contratar para executar este projeto?",
    rotulo: "Licitação ou contratação",
    pergunta: "Será necessário licitar ou contratar para executar este projeto?",
    ajuda: "Marque se a contratação pública é necessária. Se for, indique a situação e o objeto.",
    tipoResposta: "CONDICAO_FECHADA",
    impacto: "CONDICIONAL",
    obrigatoria: true,
    ordem: 1,
    etapa: GRUPO_IMPEDIMENTOS.ordem,
    grupo: GRUPO_IMPEDIMENTOS.id,
    metadados: { impedimento: true },
    favoraveis: ["atendida", "nao_se_aplica"],
    espera: "Aguardando licitação ou contratação",
    camposFollowUp: [
      {
        chave: "objeto_contratacao",
        label: "Objeto da contratação",
        tipo: "texto",
        placeholder: "Ex.: construção, serviço ou aquisição",
        obrigatorioQuando: ["pendente", "atendida"],
      },
    ],
    efeitos: [EFEITO_PRIORIDADE_APLICAVEL],
  },
  {
    codigo: "orcamento_recursos",
    texto: "Há necessidade de previsão ou dotação orçamentária para este projeto?",
    rotulo: "Orçamento",
    pergunta: "Há necessidade de previsão ou dotação orçamentária para este projeto?",
    ajuda: "Se o projeto exigir orçamento, indique se a previsão está pendente ou atendida e registre valor e fonte quando conhecidos.",
    tipoResposta: "CONDICAO_FECHADA",
    impacto: "CONDICIONAL",
    obrigatoria: true,
    ordem: 2,
    etapa: GRUPO_IMPEDIMENTOS.ordem,
    grupo: GRUPO_IMPEDIMENTOS.id,
    metadados: { impedimento: true },
    favoraveis: ["atendida", "nao_se_aplica"],
    espera: "Aguardando orçamento",
    camposFollowUp: [
      {
        chave: "valor_verba",
        label: "Valor previsto (R$), se conhecido",
        tipo: "moeda",
        placeholder: "Ex.: 1500000",
        obrigatorioQuando: ["pendente", "atendida"],
      },
      {
        chave: "fonte_confirmada",
        label: "Fonte do recurso, se conhecida",
        tipo: "texto",
        placeholder: "Ex.: recurso próprio, emenda, convênio",
      },
    ],
    efeitos: [EFEITO_PRIORIDADE_APLICAVEL, EFEITO_ORCAMENTO_PENDENTE],
  },
  {
    codigo: "desapropriacao_imovel",
    texto: "O projeto exige terreno, imóvel, aquisição ou desapropriação?",
    rotulo: "Imóvel ou desapropriação",
    pergunta: "O projeto exige terreno, imóvel, aquisição ou desapropriação?",
    ajuda: "Se aplicável, registre a situação do imóvel e, quando conhecido, o endereço ou matrícula.",
    tipoResposta: "CONDICAO_FECHADA",
    impacto: "CONDICIONAL",
    obrigatoria: true,
    ordem: 3,
    etapa: GRUPO_IMPEDIMENTOS.ordem,
    grupo: GRUPO_IMPEDIMENTOS.id,
    metadados: { impedimento: true },
    favoraveis: ["atendida", "nao_se_aplica"],
    espera: "Aguardando imóvel ou desapropriação",
    camposFollowUp: [
      {
        chave: "endereco_ou_matricula",
        label: "Endereço ou matrícula, se conhecido",
        tipo: "texto",
        placeholder: "Ex.: Rua X, Bairro Y / matrícula 12345",
      },
    ],
    efeitos: [EFEITO_PRIORIDADE_APLICAVEL],
  },
  {
    codigo: "necessidade_pl",
    texto: "É necessário projeto de lei ou outro ato de autorização?",
    rotulo: "Projeto de lei ou autorização",
    pergunta: "É necessário projeto de lei ou outro ato de autorização?",
    ajuda: "Registre a situação e a providência, sem tratar a necessidade como aprovação do ato.",
    tipoResposta: "CONDICAO_FECHADA",
    impacto: "CONDICIONAL",
    obrigatoria: true,
    ordem: 4,
    etapa: GRUPO_IMPEDIMENTOS.ordem,
    grupo: GRUPO_IMPEDIMENTOS.id,
    metadados: { impedimento: true },
    favoraveis: ["atendida", "nao_se_aplica"],
    espera: "Aguardando projeto de lei ou autorização",
    efeitos: [EFEITO_PRIORIDADE_APLICAVEL],
  },
  {
    codigo: "outro_impedimento",
    texto: "Existe outro impedimento ou pré-requisito relevante?",
    rotulo: "Outro impedimento",
    pergunta: "Existe outro impedimento ou pré-requisito relevante?",
    ajuda: "Descreva livremente qualquer outra condição que possa exigir providência.",
    tipoResposta: "CONDICAO_FECHADA",
    impacto: "CONDICIONAL",
    obrigatoria: true,
    ordem: 5,
    etapa: GRUPO_IMPEDIMENTOS.ordem,
    grupo: GRUPO_IMPEDIMENTOS.id,
    metadados: { impedimento: true },
    favoraveis: ["atendida", "nao_se_aplica"],
    espera: "Aguardando tratamento de outro impedimento",
    camposFollowUp: [
      {
        chave: "descricao_outro",
        label: "Descreva o impedimento",
        tipo: "textarea",
        placeholder: "Informe qual é o impedimento ou pré-requisito",
        obrigatorioQuando: ["pendente", "atendida"],
      },
    ],
    efeitos: [EFEITO_PRIORIDADE_APLICAVEL],
  },
];

export function adicionarImpedimentosComuns(
  modelo: ModeloSnapshot,
): ModeloSnapshot {
  const codigos = new Set<string>(CODIGOS_IMPEDIMENTOS_COMUNS);
  const perguntas = PERGUNTAS_IMPEDIMENTOS_COMUNS.map((pergunta) => ({
    ...pergunta,
    grupo: GRUPO_IMPEDIMENTOS.id,
    etapa: GRUPO_IMPEDIMENTOS.ordem,
    metadados: {
      ...pergunta.metadados,
      impedimento: true,
    },
    efeitos: pergunta.efeitos || [],
  }));
  const restante = modelo.perguntas.filter(
    (pergunta) => !codigos.has(pergunta.codigo),
  );

  return {
    ...modelo,
    perguntas: [...perguntas, ...restante],
    etapas: [
      {
        codigo: "IMPEDIMENTOS",
        nome: GRUPO_IMPEDIMENTOS.nome,
        descricao: GRUPO_IMPEDIMENTOS.ajuda,
        ordem: GRUPO_IMPEDIMENTOS.ordem,
      },
      ...(modelo.etapas || []),
    ],
  };
}
