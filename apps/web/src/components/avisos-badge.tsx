"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { API_URL } from "@/lib/api";

export function AvisosBadge({
  token,
  compact = false,
}: {
  token?: string;
  compact?: boolean;
}) {
  const [total, setTotal] = useState<number | null>(null);
  useEffect(() => {
    if (!token) return;
    let alive = true;
    let versao = 0;
    async function atualizar() {
      const atual = ++versao;
      try {
        const r = await fetch(`${API_URL}/comunicados/resumo`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) return;
        const j = await r.json();
        if (alive && atual === versao) setTotal(j.naoLidas);
      } catch {
        /* A caixa de entrada apresenta erros detalhados. */
      }
    }
    void atualizar();
    const timer = setInterval(() => void atualizar(), 30000);
    const onUpdate = () => void atualizar();
    window.addEventListener("cip:avisos-atualizados", onUpdate);
    window.addEventListener("focus", onUpdate);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("cip:avisos-atualizados", onUpdate);
      window.removeEventListener("focus", onUpdate);
    };
  }, [token]);

  const label =
    total !== null && total > 0
      ? compact
        ? `Avisos ${total}`
        : `✉ Avisos (${total})`
      : compact
        ? "Avisos"
        : "✉ Avisos";

  return (
    <Link
      href="/comunicados?aba=avisos"
      className={compact ? "app-topbar__avisos" : "cip-btn cip-btn--secondary"}
      aria-label={total !== null && total > 0 ? `Avisos, ${total} não lidos` : "Avisos"}
    >
      {label}
    </Link>
  );
}
