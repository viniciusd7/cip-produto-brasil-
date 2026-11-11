export type AppRole = "admin" | "prefeito" | "gestor" | "analista" | "leitura";

export function normalizeRole(role?: string | null): AppRole {
  if (role === "admin" || role === "prefeito" || role === "gestor" || role === "analista") {
    return role;
  }
  return "leitura";
}

export function canWriteRole(role?: string | null) {
  return ["admin", "gestor", "analista"].includes(normalizeRole(role));
}

/** Gabinete e admin cadastram pastas, siglas e responsáveis. */
export function canManageSecretariaRole(role?: string | null) {
  return ["admin", "prefeito"].includes(normalizeRole(role));
}

/** Edição de secretaria: gabinete (manage) ou secretário/equipe (write). */
export function canEditSecretariaRole(role?: string | null) {
  return canManageSecretariaRole(role) || canWriteRole(role);
}

export function canValidateRole(role?: string | null) {
  return ["admin", "gestor"].includes(normalizeRole(role));
}

export function getHomeForRole(role?: string | null) {
  switch (normalizeRole(role)) {
    case "admin":
      return "/administracao";
    case "gestor":
      return "/minha-pasta";
    case "analista":
      return "/carteira";
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
    analista: "Equipe",
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
        label: "Atualizar minha pasta",
        hint: "Projetos e pendências da secretaria",
      };
    case "analista":
      return {
        href: "/carteira",
        label: "Entrar nos projetos",
        hint: "Tarefas, subtarefas e evidências",
      };
    case "admin":
      return {
        href: "/administracao",
        label: "Administrar plataforma",
        hint: "Usuários, cadastros e importação",
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

/** Ordem da jornada: Cenário → Minha pasta → Projeto → Cobrança. */
const ALL_NAV: NavItem[] = [
  { href: "/painel", label: "Cenário" },
  { href: "/minha-pasta", label: "Minha pasta" },
  { href: "/carteira", label: "Projetos" },
  { href: "/acoes", label: "Ações" },
  { href: "/planejamento", label: "Plano" },
  { href: "/pendencias", label: "Agenda" },
  { href: "/relatorios", label: "Prestação" },
  { href: "/comunicados", label: "Avisos e conversas", icon: "✉" },
  { href: "/importacao", label: "Importação" },
  { href: "/administracao", label: "Administração" },
];

export function getNavForRole(role?: string | null): NavItem[] {
  const r = normalizeRole(role);
  const allow = new Set<string>();

  if (r === "admin") {
    ALL_NAV.forEach((n) => allow.add(n.href));
  } else if (r === "prefeito") {
    ["/painel", "/carteira", "/pendencias", "/relatorios"].forEach((h) => allow.add(h));
  } else if (r === "gestor") {
    ["/painel", "/minha-pasta", "/carteira", "/acoes", "/pendencias"].forEach((h) =>
      allow.add(h),
    );
  } else if (r === "analista") {
    ["/minha-pasta", "/carteira", "/acoes", "/relatorios"].forEach((h) => allow.add(h));
  } else {
    ["/painel", "/relatorios"].forEach((h) => allow.add(h));
  }

  if (["gestor", "analista", "admin"].includes(r)) allow.add("/comunicados");

  let seq = 0;
  return ALL_NAV.filter((n) => allow.has(n.href)).map((n) => {
    if (n.icon) return n;
    seq += 1;
    return { ...n, icon: String(seq).padStart(2, "0") };
  });
}
