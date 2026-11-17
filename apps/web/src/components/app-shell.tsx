"use client";

import Link from "next/link";
import { AvisosBadge } from "./avisos-badge";
import { NotificacoesBadge } from "./notificacoes-badge";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { TenantSwitcher } from "@/components/tenant-switcher";
import { s as overview } from "@/components/overview/ov";
import {
  getHomeForRole,
  getNavForRole,
  getNextStepForRole,
  getRoleLabel,
  type NavItem,
} from "@/lib/roles";
import { VoltarBar } from "@/components/voltar-bar";

function navItemActive(pathname: string, item: NavItem, nav: NavItem[]) {
  if (item.children?.length) {
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }
  if (pathname === item.href) return true;
  if (!pathname.startsWith(`${item.href}/`)) return false;
  return !nav.some(
    (other) =>
      other.href !== item.href &&
      other.href.startsWith(`${item.href}/`) &&
      (pathname === other.href || pathname.startsWith(`${other.href}/`)),
  );
}

export function AppShell({
  children,
  initialRole,
  initialName,
  initialMunicipio,
  initialIsPlatformAdmin,
}: {
  children: React.ReactNode;
  initialRole?: string;
  initialName?: string | null;
  initialMunicipio?: string | null;
  initialIsPlatformAdmin?: boolean;
}) {
  const pathname = usePathname();
  const { data } = useSession();
  const [open, setOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const menuToggleRef = useRef<HTMLButtonElement>(null);
  const railRef = useRef<HTMLElement>(null);
  const role = data?.user?.role || initialRole;
  const isCentralCip = Boolean(
    (data?.user?.isPlatformAdmin ?? initialIsPlatformAdmin) &&
      !(data?.user?.municipioId || ""),
  );
  const visibleNav = isCentralCip
    ? getNavForRole(role).filter((item) => item.href === "/equipe")
    : getNavForRole(role);
  const nextStep = getNextStepForRole(role);
  const flowSteps = isCentralCip
    ? ["Prefeituras", "Consultores", "Equipes", "Acessos"]
    : role === "gestor"
      ? ["Minha pasta", "Projetos", "Tarefas", "Evidências"]
      : role === "analista"
        ? ["Visão geral", "Secretarias", "Projetos", "Tarefas"]
        : ["Visão geral", "Pasta", "Projeto", "Cobrança"];
  const userName = data?.user?.name || initialName;
  const municipioNome = data?.user?.municipioNome || initialMunicipio;
  const onPainel = pathname === "/painel";

  useEffect(() => {
    const frame = requestAnimationFrame(() => setOpen(false));
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const rail = railRef.current;
    if (!rail) return;

    const focusable = () =>
      Array.from(
        rail.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);

    const getEnds = () => {
      const nodes = focusable();
      return { first: nodes[0], last: nodes[nodes.length - 1], nodes };
    };

    const { first } = getEnds();
    requestAnimationFrame(() => first?.focus());

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        menuToggleRef.current?.focus();
        return;
      }
      if (e.key !== "Tab") return;
      const { first, last, nodes } = getEnds();
      if (!nodes.length) return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div
      className={`app-shell ${overview.shell}${onPainel ? " shell-painel" : ""}${open ? " nav-open" : ""}`}
    >
      <header className="app-topbar">
        <div className="app-topbar__brand">
          <BrandLogo variant="mark" />
          <span>Governo em perspectiva</span>
        </div>
        <div className="app-topbar__actions">
          {!isCentralCip && role !== "leitura" && <NotificacoesBadge token={data?.accessToken} />}
          {!isCentralCip && ["gestor", "analista", "admin"].includes(role || "") && (
            <AvisosBadge token={data?.accessToken} compact />
          )}
          <button
            ref={menuToggleRef}
            type="button"
            className="menu-toggle"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            aria-expanded={open}
            aria-controls="app-rail-menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "✕" : "☰"}
          </button>
        </div>
      </header>

      <button
        type="button"
        className="app-overlay"
        aria-label="Fechar menu"
        tabIndex={-1}
        onClick={() => setOpen(false)}
        aria-hidden={!open}
      />

      <aside
        ref={railRef}
        id="app-rail-menu"
        className="app-rail"
        aria-label="Menu lateral"
      >
        <div className="brand-block">
          <BrandLogo priority />
          <div className="brand-kicker">Centro de Inteligência Pública</div>
          <div className="brand-subtitle">Da estratégia à entrega</div>
        </div>

        <div className="tenant-block">
          <span>{isCentralCip ? "Console da plataforma" : "Prefeitura conectada"}</span>
          <TenantSwitcher initialMunicipio={municipioNome} />
          {!isCentralCip && <small>{getRoleLabel(role)}</small>}
        </div>

        <div className="journey-strip" aria-label="Seu próximo passo">
          <div className="journey-strip__label">Seu próximo passo</div>
          <Link href={nextStep.href} className="journey-step active next-step-cta">
            <span className="journey-step__n">→</span>
            <span>
              <strong>{nextStep.label}</strong>
              <small>{nextStep.hint}</small>
            </span>
          </Link>
          <ol className="flow-mini">
            {flowSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>

        <nav className="app-nav" aria-label="Navegação principal">
          {visibleNav.map((item) => {
            if (item.children?.length) {
              const branchActive = navItemActive(pathname, item, visibleNav);
              const expanded = openGroups[item.href] ?? branchActive;
              return (
                <div key={item.href} className="app-nav__group">
                  <div className="app-nav__group-head">
                    <Link href={item.href} className={branchActive ? "active" : ""} aria-current={pathname === item.href ? "page" : undefined}>
                      <span className="nav-icon" aria-hidden="true">{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                    <button
                      type="button"
                      className="app-nav__toggle"
                      aria-label={`${expanded ? "Ocultar" : "Mostrar"} categorias de ${item.label}`}
                      aria-expanded={expanded}
                      onClick={() => setOpenGroups((current) => ({ ...current, [item.href]: !expanded }))}
                    >
                      <span className="app-nav__chevron" aria-hidden="true">{expanded ? "▾" : "▸"}</span>
                    </button>
                  </div>
                  {expanded && (
                    <div className="app-nav__children" role="group" aria-label={item.label}>
                      {item.children.map((child) => {
                        const childActive = pathname === child.href;
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={childActive ? "active" : ""}
                            aria-current={childActive ? "page" : undefined}
                          >
                            <span>{child.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }
            const active = navItemActive(pathname, item, visibleNav);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? "active" : ""}
              >
                <span className="nav-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="app-user">
          <div className="user-avatar">
            {(userName || "C").slice(0, 1).toUpperCase()}
          </div>
          <div className="user-copy">
            <strong>{userName}</strong>
            <span>{getRoleLabel(role)}</span>
          </div>
          <button
            className="logout-button"
            title="Sair"
            aria-label="Sair"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            ↗
          </button>
        </div>
      </aside>

      <main className="app-main" aria-hidden={open ? true : undefined}>
        <VoltarBar home={isCentralCip ? "/equipe" : getHomeForRole(role)} />
        {children}
        <footer className="app-cip-footer">
          <span>
            CIP — Centro de Inteligência Pública · Plataforma de Inteligência de
            Gestão Municipal
          </span>
          <a
            href="https://cipinteligenciapublica.com.br/"
            target="_blank"
            rel="noreferrer"
          >
            cipinteligenciapublica.com.br
          </a>
        </footer>
      </main>
    </div>
  );
}
