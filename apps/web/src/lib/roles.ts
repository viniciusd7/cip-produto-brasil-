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

export type NavItem = { href: string; label: string; icon: string };

const ALL_NAV: NavItem[] = [
  { href: "/painel", label: "Cenário", icon: "01" },
  { href: "/minha-pasta", label: "Minha pasta", icon: "02" },
  { href: "/secretarias", label: "Pastas", icon: "02b" },
  { href: "/pendencias", label: "Agenda", icon: "03" },
  { href: "/relatorios", label: "Prestação", icon: "04" },
  { href: "/carteira", label: "Projetos", icon: "05" },
  { href: "/acoes", label: "Ações", icon: "06" },
  { href: "/planejamento", label: "Plano", icon: "07" },
  { href: "/importacao", label: "Importação", icon: "08" },
  { href: "/administracao", label: "Administração", icon: "09" },
];

export function getNavForRole(role?: string | null): NavItem[] {
  const r = normalizeRole(role);
  const allow = new Set<string>();

  if (r === "admin") {
    ALL_NAV.forEach((n) => allow.add(n.href));
  } else if (r === "prefeito") {
    ["/painel", "/pendencias", "/relatorios", "/carteira"].forEach((h) => allow.add(h));
  } else if (r === "gestor") {
    ["/minha-pasta", "/secretarias", "/carteira", "/pendencias", "/acoes", "/painel"].forEach(
      (h) => allow.add(h),
    );
  } else if (r === "analista") {
    ["/carteira", "/acoes", "/relatorios", "/secretarias"].forEach((h) => allow.add(h));
  } else {
    ["/painel", "/relatorios"].forEach((h) => allow.add(h));
  }

  return ALL_NAV.filter((n) => allow.has(n.href));
}
