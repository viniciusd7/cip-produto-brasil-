/** Dimensões de status independentes — nunca misturar em um único campo. */

export const CICLO_INICIATIVA = [
  "RASCUNHO",
  "EM_PLANEJAMENTO",
  "AGUARDANDO_PRE_REQUISITO",
  "EM_ACOMPANHAMENTO",
  "CONCLUIDA",
  "SUSPENSA",
  "ENCERRADA_SEM_SOLUCAO",
] as const;
export type CicloIniciativa = (typeof CICLO_INICIATIVA)[number];

export const CLASSIFICACAO_PROJETO = [
  "ESTRUTURANTE",
  "PLANO_GOVERNO",
  "ACAO_DIARIA",
] as const;
export type ClassificacaoProjeto = (typeof CLASSIFICACAO_PROJETO)[number];

export const IMPACTO_PERGUNTA = ["BLOQUEANTE", "CONDICIONAL", "INFORMATIVA"] as const;
export type ImpactoPergunta = (typeof IMPACTO_PERGUNTA)[number];

export const TIPO_RESPOSTA_VIABILIDADE = [
  "SIM_NAO",
  "SIM_NAO_ANDAMENTO",
  "SELECAO",
  "DATA",
  "NUMERO",
  "ANEXO_REF",
  "CONDICAO_FECHADA",
] as const;
export type TipoRespostaViabilidade = (typeof TIPO_RESPOSTA_VIABILIDADE)[number];

export const PRAZO_MARCO = [
  "SEM_PRAZO",
  "NO_PRAZO",
  "VENCIDO",
  "CONCLUIDO",
] as const;
export type PrazoMarco = (typeof PRAZO_MARCO)[number];

export const SITUACAO_VERIFICACAO = [
  "NAO_INICIADA",
  "EM_ANALISE",
  "ATENDIDA",
  "PENDENTE",
  "DISPENSADA_COM_FUNDAMENTO",
] as const;
export type SituacaoVerificacao = (typeof SITUACAO_VERIFICACAO)[number];

export const APLICABILIDADE = ["SIM", "NAO", "A_AVALIAR"] as const;
export type Aplicabilidade = (typeof APLICABILIDADE)[number];

export const ENTRAVE_STATUS = [
  "ABERTO",
  "EM_ENCAMINHAMENTO",
  "RESOLVIDO",
  "SEM_SOLUCAO",
] as const;
export type EntraveStatus = (typeof ENTRAVE_STATUS)[number];

export const EVIDENCIA_STATUS = [
  "DECLARADA",
  "A_VERIFICAR",
  "VERIFICADA",
  "REJEITADA",
  "NAO_DISPONIBILIZADA",
] as const;
export type EvidenciaStatus = (typeof EVIDENCIA_STATUS)[number];

export const PUBLICACAO_STATUS = [
  "INTERNA",
  "ELEGIVEL_REVISAO",
  "AUTORIZADA_INSTITUCIONAL",
] as const;
export type PublicacaoStatus = (typeof PUBLICACAO_STATUS)[number];

export const EFEITO_AVANCO = [
  "INFORMATIVO",
  "REQUER_PROVIDENCIA",
  "RESTRICAO_VALIDADA",
] as const;
export type EfeitoAvanco = (typeof EFEITO_AVANCO)[number];

export const DECISAO_STATUS = [
  "ABERTA",
  "EM_ANDAMENTO",
  "CONCLUIDA",
  "CANCELADA",
] as const;
export type DecisaoStatus = (typeof DECISAO_STATUS)[number];

export function derivarPrazoMarco(params: {
  prazoVigente: Date | null;
  concluidoEm: Date | null;
  dataReferencia?: Date;
}): PrazoMarco {
  if (params.concluidoEm) return "CONCLUIDO";
  if (!params.prazoVigente) return "SEM_PRAZO";
  const ref = params.dataReferencia ?? new Date();
  return params.prazoVigente.getTime() < ref.getTime() ? "VENCIDO" : "NO_PRAZO";
}

export const PRIORIDADE_NIVEL = ["BAIXA", "MEDIA", "ALTA", "CRITICA"] as const;
export type PrioridadeNivel = (typeof PRIORIDADE_NIVEL)[number];

/** Situação de uma etapa da sequência legal (dimensão separada do ciclo). */
export const ETAPA_STATUS = [
  "PENDENTE",
  "EM_ANDAMENTO",
  "BLOQUEADA",
  "CONCLUIDA",
  "NAO_APLICAVEL",
] as const;
export type EtapaStatus = (typeof ETAPA_STATUS)[number];
