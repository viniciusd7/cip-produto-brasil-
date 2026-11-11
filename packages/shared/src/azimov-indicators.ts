/** Kit visual Azimov — única fonte para séries, categorias e status de tarefa. */

export const AZIMOV = {
  bg: "#10121b",
  bgElevated: "#171923",
  panel: "#202332",
  ink: "#f1f3fc",
  muted: "#929bb4",
  border: "#ffffff12",
  rose: "#ff5982",
  roseSoft: "#ff779a",
  violet: "#7c9cff",
  lavender: "#b9a0ff",
  green: "#b4e4a0",
  gold: "#eac78c",
  slate: "#59647f",
} as const;

/** Séries do panorama / linha do tempo */
export const SERIES = {
  atraso: AZIMOV.rose,
  atencao: AZIMOV.violet,
  semAtraso: AZIMOV.green,
} as const;

/** Classificação de pastas (sinais do Cenário) */
export const CLASS_COLORS: Record<string, string> = {
  INTERVENCAO: AZIMOV.roseSoft,
  ACOMPANHAMENTO: AZIMOV.gold,
  ROTINA: AZIMOV.green,
  DADOS_DEFASADOS: AZIMOV.lavender,
};

export const CLASS_GROUPS = [
  {
    key: "INTERVENCAO",
    label: "Intervenção prioritária",
    hint: "Cobrar plano de recuperação",
    color: CLASS_COLORS.INTERVENCAO,
  },
  {
    key: "ACOMPANHAMENTO",
    label: "Acompanhamento próximo",
    hint: "Tratar riscos de execução",
    color: CLASS_COLORS.ACOMPANHAMENTO,
  },
  {
    key: "ROTINA",
    label: "Rotina de monitoramento",
    hint: "Sustentar as entregas",
    color: CLASS_COLORS.ROTINA,
  },
  {
    key: "DADOS_DEFASADOS",
    label: "Dados defasados",
    hint: "Validar antes de decidir",
    color: CLASS_COLORS.DADOS_DEFASADOS,
  },
] as const;

export const GRAVIDADE_COLORS: Record<string, string> = {
  LEVE: AZIMOV.gold,
  MODERADA: AZIMOV.gold,
  GRAVE: AZIMOV.roseSoft,
  CRITICA: AZIMOV.rose,
};

export const PAINEL_TOC = [
  { id: "visao", label: "Situação geral", href: "/painel#visao" },
  { id: "secretarias", label: "Secretarias", href: "/painel#secretarias" },
  { id: "meta-estrategica", label: "Metas estratégicas", href: "/painel#meta-estrategica" },
  { id: "meta-execucao", label: "Metas de execução", href: "/painel#meta-execucao" },
  { id: "atencao", label: "Atenção agora", href: "/painel#atencao" },
  { id: "detalhes", label: "Análise detalhada", href: "/painel#detalhes" },
] as const;
