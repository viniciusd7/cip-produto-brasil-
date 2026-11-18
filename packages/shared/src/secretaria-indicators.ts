/** Critérios usados no cálculo e na explicação dos indicadores das secretarias. */
export const METODOLOGIA_SECRETARIAS = {
  versao: "v1-2026-10",
  diasSemAtualizacao: 30,
  intervencao: { pctAtraso: 50, indicePonderado: 35 },
  acompanhamento: { pctAtraso: 35, pctSemPrazo: 25 },
  pesosGravidade: { LEVE: 0.25, MODERADA: 0.5, GRAVE: 0.75, CRITICA: 1 },
} as const;
