"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

function destinoPadrao(pathname: string, home: string) {
  if (pathname.startsWith("/iniciativas/")) {
    return home === "/minha-pasta" ? "/minha-pasta/projetos" : "/carteira";
  }
  const partes = pathname.split("/").filter(Boolean);
  if (partes.length > 1) return `/${partes.slice(0, -1).join("/")}`;
  return home;
}

export function VoltarBar({ home }: { home: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const trilha = useRef<string[]>([]);
  const [anterior, setAnterior] = useState<string | null>(null);

  useEffect(() => {
    const pilha = trilha.current;
    const ultimo = pilha[pilha.length - 1];
    if (ultimo === pathname) return;
    if (pilha.length >= 2 && pilha[pilha.length - 2] === pathname) {
      pilha.pop();
    } else {
      pilha.push(pathname);
    }
    setAnterior(pilha.length >= 2 ? pilha[pilha.length - 2] : null);
  }, [pathname]);

  if (pathname === home) return null;

  const destino = anterior && anterior !== pathname ? anterior : destinoPadrao(pathname, home);

  return (
    <div className="app-back-bar">
      <button
        type="button"
        className="app-back"
        onClick={() => router.push(destino)}
      >
        <span aria-hidden="true">←</span>
        Voltar
      </button>
    </div>
  );
}
