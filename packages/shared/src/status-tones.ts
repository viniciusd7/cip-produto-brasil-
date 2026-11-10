/** Tons semânticos CIP — única fonte para Badge / charts / UI. */

export type CipTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "gold"
  | "rose"
  | "violet";

export function tonePrazo(status: string): CipTone {
  if (status === "VENCIDO") return "danger";
  if (status === "SEM_PRAZO") return "warning";
  if (status === "CONCLUIDO") return "success";
  return "info";
}

export function toneEvidencia(status: string): CipTone {
  if (status === "VERIFICADA") return "success";
  if (status === "REJEITADA") return "danger";
  return "warning";
}

export function toneGravidade(g: string): CipTone {
  const v = g.toUpperCase();
  if (v === "CRITICA" || v === "GRAVE") return "danger";
  if (v === "MODERADA") return "gold";
  if (v === "LEVE") return "gold";
  return "neutral";
}

import { GRAVIDADE_COLORS } from "./azimov-indicators";

/** Cores hex Azimov — para Recharts / barras. */
export const gravidadeChartColor: Record<string, string> = { ...GRAVIDADE_COLORS };

/** Azimov: rose / gold / green / violet — categorias distintas no dark e no light. */
export function toneClassPasta(c: string): CipTone {
  if (c === "INTERVENCAO") return "rose";
  if (c === "ACOMPANHAMENTO") return "gold";
  if (c === "DADOS_DEFASADOS") return "violet";
  if (c === "ROTINA") return "success";
  return "neutral";
}

export function toneCiclo(ciclo: string): CipTone {
  const v = ciclo.toUpperCase();
  if (v.includes("CONCLUID") || v === "ENCERRADA") return "success";
  if (v.includes("AGUARD") || v.includes("BLOQUE")) return "warning";
  if (v.includes("CANCEL")) return "danger";
  if (v.includes("ACOMPANH")) return "info";
  return "neutral";
}

/** Prioridade do projeto (importância/urgência). Dimensão independente do ciclo. */
export function tonePrioridade(nivel: string | null | undefined): CipTone {
  switch ((nivel || "").toUpperCase()) {
    case "CRITICA":
      return "danger";
    case "ALTA":
      return "rose";
    case "MEDIA":
      return "gold";
    default:
      return "neutral";
  }
}

export function toneEtapa(status: string): CipTone {
  switch (status) {
    case "CONCLUIDA":
      return "success";
    case "BLOQUEADA":
      return "danger";
    case "EM_ANDAMENTO":
      return "info";
    case "PENDENTE":
      return "warning";
    default:
      return "neutral";
  }
}
