import { getNavForRole, normalizeRole, type NavItem } from "./roles";

/** Mobile shortcuts are always a subset of the role's existing navigation. */
export function getMobileNavForRole(role?: string | null): NavItem[] {
  const priorities: Record<string, string[]> = {
    prefeito: ["/painel", "/carteira", "/pendencias"],
    gestor: ["/minha-pasta", "/minha-pasta/projetos", "/pendencias"],
    funcionario: ["/minha-pasta", "/minha-pasta/projetos", "/pendencias"],
    analista: ["/painel", "/secretarias", "/acoes"],
    admin: ["/painel", "/carteira", "/equipe"],
    leitura: ["/painel", "/relatorios", "/base-conhecimento"],
  };
  const labels: Record<string, string> = {
    "/painel": "Início",
    "/minha-pasta": "Minha pasta",
    "/base-conhecimento": "Conhecimento",
    "/equipe": "Equipe",
  };
  const allowed = getNavForRole(role);
  return priorities[normalizeRole(role)].flatMap((href) => {
    const item = allowed.find((candidate) => candidate.href === href);
    return item ? [{ ...item, label: labels[href] || item.label }] : [];
  });
}

export function mobileNavActive(pathname: string, item: NavItem, items: NavItem[]) {
  if (pathname.startsWith("/iniciativas/")) {
    return item.href === "/carteira" || item.href === "/minha-pasta/projetos";
  }
  const matching = items.filter((candidate) =>
    pathname === candidate.href || pathname.startsWith(`${candidate.href}/`),
  ).sort((a, b) => b.href.length - a.href.length);
  return matching[0]?.href === item.href;
}
