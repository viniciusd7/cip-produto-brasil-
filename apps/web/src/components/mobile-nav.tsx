"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { NavItem } from "@/lib/roles";
import { mobileNavActive } from "@/lib/mobile-navigation";

export function NavigationIcon({ href }: { href: string }) {
  const paths: Record<string, string> = {
    "/painel": "m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9",
    "/minha-pasta": "M3 7h7l2 2h9v11H3zM3 7V4h7l2 3",
    "/carteira": "M3 7h18v14H3zM8 7V3h8v4M3 12h18M10 12v3h4v-3",
    "/minha-pasta/projetos": "M3 7h18v14H3zM8 7V3h8v4M3 12h18M10 12v3h4v-3",
    "/pendencias": "M4 5h16v16H4zM8 3v4M16 3v4M4 10h16M8 14h3M8 17h6",
    "/acoes": "m3 6 2 2 4-4M12 6h9M3 13l2 2 4-4M12 13h9M3 20l2 2 4-4M12 20h9",
    "/secretarias": "M3 21h18M5 21V8l7-5 7 5v13M9 10h1M14 10h1M9 14h1M14 14h1M10 21v-4h4v4",
    "/equipe": "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-4M17 3a4 4 0 0 1 0 8",
    "/relatorios": "M5 3h10l4 4v14H5zM14 3v5h5M9 17v-4M13 17v-6M17 17v-3",
    "/base-conhecimento": "M12 5v16M12 5C9 3 5 3 2 4v15c4-1 7-1 10 2 3-3 6-3 10-2V4c-3-1-7-1-10 1",
    menu: "M4 6h16M4 12h16M4 18h16",
  };
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[href] || paths.menu} /></svg>;
}

export function MobileNav({ items, pathname, open, onOpen }: {
  items: NavItem[];
  pathname: string;
  open: boolean;
  onOpen: (button: HTMLButtonElement) => void;
}) {
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    let fullHeight = window.innerHeight;
    const update = () => {
      const editing = document.activeElement?.matches('input:not([type="checkbox"], [type="radio"]), textarea, [contenteditable="true"]');
      if (!editing) fullHeight = window.innerHeight;
      setKeyboardOpen(Boolean(editing && (window.innerHeight - viewport.height > 120 || viewport.height < fullHeight * 0.75)));
    };
    viewport.addEventListener("resize", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    return () => {
      viewport.removeEventListener("resize", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
    };
  }, []);
  return (
    <nav className="mobile-nav" aria-label="Atalhos do celular" inert={open} hidden={keyboardOpen}>
      {items.map((item) => {
        const active = mobileNavActive(pathname, item, items);
        return <Link key={item.href} href={item.href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>
          <NavigationIcon href={item.href} /><span>{item.label}</span>
        </Link>;
      })}
      <button type="button" onClick={(event) => onOpen(event.currentTarget)} aria-expanded={open} aria-controls="app-rail-menu" aria-label="Abrir menu completo">
        <NavigationIcon href="menu" /><span>Menu</span>
      </button>
    </nav>
  );
}
