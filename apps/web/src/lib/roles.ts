export type AppRole = "admin" | "prefeito" | "gestor" | "analista" | "leitura";

export function normalizeRole(role?: string | null): AppRole {
  if (role === "admin" || role === "prefeito" || role === "gestor" || role === "analista") {
    return role;
  }
  return "leitura";
}

export function canWriteRole(role?: string | null) {
  return ["admin", "analista"].includes(normalizeRole(role));
}

export function canSubmitEvidenceRole(role?: string | null) {
  return ["admin", "gestor", "analista"].includes(normalizeRole(role));
}

/** Consultoria cadastra pastas, siglas e responsáveis; o prefeito só acompanha. */
export function canManageSecretariaRole(role?: string | null) {
  return ["admin", "analista"].includes(normalizeRole(role));
}

export function canEditSecretariaRole(role?: string | null) {
  return canManageSecretariaRole(role);
}

export function canValidateRole(role?: string | null) {
  return ["admin", "analista"].includes(normalizeRole(role));
}

export function getHomeForRole(role?: string | null) {
  switch (normalizeRole(role)) {
    case "admin":
      return "/painel";
    case "gestor":
      return "/minha-pasta";
    case "analista":
      return "/implantacao";
    case "prefeito":
    case "leitura":
    default:
      return "/painel";
  }
}

export function getRoleLabel(role?: string | null) {
  const map: Record<AppRole, string> = {
    admin: "Administração CIP",
    prefeito: "Gabinete do Prefeito",
    gestor: "Secretário",
    analista: "Consultor",
    leitura: "Consulta",
  };
  return map[normalizeRole(role)];
}

export function getNextStepForRole(role?: string | null): {
  href: string;
  label: string;
  hint: string;
} {
  switch (normalizeRole(role)) {
    case "prefeito":
      return {
        href: "/pendencias",
        label: "Abrir agenda de cobrança",
        hint: "Quem cobrar nesta quinzena",
      };
    case "gestor":
      return {
        href: "/minha-pasta",
        label: "Abrir minha secretaria",
        hint: "Acompanhe entregas e envie evidências",
      };
    case "analista":
      return {
        href: "/implantacao",
        label: "Continuar implantação",
        hint: "Secretarias, plano, metas, indicadores e tarefas",
      };
    case "admin":
      return {
        href: "/equipe",
        label: "Equipe da prefeitura",
        hint: "Prefeito, secretários e acessos",
      };
    default:
      return {
        href: "/painel",
        label: "Ver cenário do governo",
        hint: "Leitura consolidada da carteira",
      };
  }
}

export type NavItem = { href: string; label: string; icon?: string };

/** Ordem da jornada: Cenário → Minha secretaria → Projeto → Cobrança. */
const ALL_NAV: NavItem[] = [
  { href: "/painel", label: "Cenário" },
  { href: "/implantacao", label: "Implantação" },
  { href: "/minha-pasta", label: "Minha secretaria" },
  { href: "/secretarias", label: "Secretarias" },
  { href: "/planejamento", label: "Plano de governo" },
  { href: "/carteira", label: "Projetos" },
  { href: "/acoes", label: "Tarefas" },
  { href: "/validacoes", label: "Validações" },
  { href: "/pendencias", label: "Agenda" },
  { href: "/relatorios", label: "Prestação" },
  { href: "/notificacoes", label: "Notificações", icon: "🔔" },
  { href: "/comunicados", label: "Avisos e conversas", icon: "✉" },
  { href: "/importacao", label: "Importação" },
  { href: "/equipe", label: "Equipe" },
];

export function getNavForRole(role?: string | null): NavItem[] {
  const r = normalizeRole(role);
  const allow = new Set<string>();

  if (r === "admin") {
    ALL_NAV.forEach((n) => allow.add(n.href));
  } else if (r === "prefeito") {
    ["/painel", "/secretarias", "/carteira", "/pendencias", "/relatorios"].forEach((h) =>
      allow.add(h),
    );
  } else if (r === "gestor") {
    ["/minha-pasta", "/pendencias"].forEach((h) =>
      allow.add(h),
    );
  } else if (r === "analista") {
    [
      "/implantacao",
      "/secretarias",
      "/planejamento",
      "/carteira",
      "/acoes",
      "/validacoes",
      "/pendencias",
      "/relatorios",
      "/equipe",
    ].forEach((h) =>
      allow.add(h),
    );
  } else {
    ["/painel", "/relatorios"].forEach((h) => allow.add(h));
  }

  if (["gestor", "analista", "admin"].includes(r)) allow.add("/comunicados");
  if (r !== "leitura") allow.add("/notificacoes");

  let seq = 0;
  return ALL_NAV.filter((n) => allow.has(n.href)).map((n) => {
    if (n.icon) return n;
    seq += 1;
    return { ...n, icon: String(seq).padStart(2, "0") };
  });
}
