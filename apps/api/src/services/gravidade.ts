import type { PrazoMarco } from "@cip/shared";

export type Gravidade = "LEVE" | "MODERADA" | "GRAVE" | "CRITICA";

const WEIGHT: Record<Gravidade, number> = {
  LEVE: 0.25,
  MODERADA: 0.5,
  GRAVE: 0.75,
  CRITICA: 1,
};

/** Índice ponderado = soma(pesos dos atrasos) / tarefas abertas. Versão metodológica v1. */
export const GRAVIDADE_METODO_VERSAO = "v1-2026-10";

export function pesoGravidade(g?: string | null) {
  if (!g) return WEIGHT.MODERADA;
  return WEIGHT[g as Gravidade] ?? WEIGHT.MODERADA;
}

export function derivarGravidade(params: {
  prazoStatus: PrazoMarco;
  prazoOriginal: Date | null;
  prazoVigente: Date | null;
  reprogramacoes: number;
  dataReferencia?: Date | null;
}): Gravidade | null {
  if (params.prazoStatus !== "VENCIDO") return null;
  const ref = params.dataReferencia ?? new Date();
  const base = params.prazoOriginal ?? params.prazoVigente;
  if (!base) return "MODERADA";
  const dias = Math.max(
    0,
    Math.floor((ref.getTime() - base.getTime()) / (1000 * 60 * 60 * 24)),
  );

  let g: Gravidade = "LEVE";
  if (dias >= 45) g = "CRITICA";
  else if (dias >= 21) g = "GRAVE";
  else if (dias >= 7) g = "MODERADA";

  if (params.reprogramacoes >= 2 && g === "LEVE") g = "MODERADA";
  if (params.reprogramacoes >= 3 && (g === "LEVE" || g === "MODERADA")) g = "GRAVE";
  if (params.prazoVigente && params.prazoVigente < ref && g !== "CRITICA") {
    // novo prazo também vencido eleva um nível
    if (g === "LEVE") g = "MODERADA";
    else if (g === "MODERADA") g = "GRAVE";
    else g = "CRITICA";
  }
  return g;
}

export function indicePonderado(atrasos: Array<{ gravidade?: string | null }>, abertas: number) {
  if (!abertas) return 0;
  const soma = atrasos.reduce((acc, a) => acc + pesoGravidade(a.gravidade), 0);
  return Math.round((soma / abertas) * 1000) / 10; // 1 casa percentual
}

export type ClassificacaoSecretaria =
  | "INTERVENCAO"
  | "ACOMPANHAMENTO"
  | "ROTINA"
  | "DADOS_DEFASADOS";

export function classificarSecretaria(params: {
  diasSemAtualizacao: number | null;
  pctAtrasoAbertas: number;
  indicePonderado: number;
  pctSemPrazoAbertas: number;
}): ClassificacaoSecretaria {
  if (params.diasSemAtualizacao != null && params.diasSemAtualizacao > 30) {
    return "DADOS_DEFASADOS";
  }
  if (params.pctAtrasoAbertas >= 50 || params.indicePonderado >= 35) {
    return "INTERVENCAO";
  }
  if (params.pctAtrasoAbertas >= 35 || params.pctSemPrazoAbertas >= 25) {
    return "ACOMPANHAMENTO";
  }
  return "ROTINA";
}
