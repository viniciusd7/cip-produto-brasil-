"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

export function AjudaCampo({ campo, children }: { campo: string; children: string }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [aberto, setAberto] = useState(false);

  useLayoutEffect(() => {
    if (!aberto || !detailsRef.current || !popupRef.current) return;
    const trigger = detailsRef.current.getBoundingClientRect();
    const popup = popupRef.current;
    const width = Math.min(260, window.innerWidth - 24);
    popup.style.width = `${width}px`;
    const height = popup.getBoundingClientRect().height;
    popup.style.left = `${Math.max(12, Math.min(trigger.left, window.innerWidth - width - 12))}px`;
    const below = trigger.bottom + 4;
    popup.style.top = `${below + height <= window.innerHeight - 12
      ? below
      : Math.max(12, trigger.top - height - 4)}px`;
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    function fechar() {
      if (detailsRef.current) detailsRef.current.open = false;
    }
    function aoClicar(event: MouseEvent) {
      if (event.target instanceof Node && !detailsRef.current?.contains(event.target)) fechar();
    }
    function aoTeclar(event: KeyboardEvent) {
      if (event.key === "Escape") {
        fechar();
        detailsRef.current?.querySelector("summary")?.focus();
      }
    }
    function aoRolar(event: Event) {
      if (event.target instanceof Node && detailsRef.current?.contains(event.target)) return;
      fechar();
    }
    document.addEventListener("click", aoClicar);
    document.addEventListener("keydown", aoTeclar);
    window.addEventListener("resize", fechar);
    window.addEventListener("scroll", aoRolar, true);
    return () => {
      document.removeEventListener("click", aoClicar);
      document.removeEventListener("keydown", aoTeclar);
      window.removeEventListener("resize", fechar);
      window.removeEventListener("scroll", aoRolar, true);
    };
  }, [aberto]);

  return (
    <details ref={detailsRef} className="ajuda-campo" onToggle={(event) => setAberto(event.currentTarget.open)}>
      <summary aria-label={`Ajuda sobre ${campo}`}>?</summary>
      <div ref={popupRef} className="ajuda-campo__popup">{children}</div>
    </details>
  );
}

export function RotuloComAjuda({
  htmlFor,
  campo,
  ajuda,
}: {
  htmlFor: string;
  campo: string;
  ajuda: string;
}) {
  return (
    <div className="rotulo-com-ajuda">
      <label htmlFor={htmlFor}>{campo}</label>
      <AjudaCampo campo={campo}>{ajuda}</AjudaCampo>
    </div>
  );
}
