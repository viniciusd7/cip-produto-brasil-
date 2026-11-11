"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { API_URL } from "@/lib/api";

export function NotificacoesBadge({ token }: { token?: string }) {
  const [total, setTotal] = useState<number | null>(null);
  useEffect(() => {
    if (!token) return;
    let alive = true;
    async function atualizar() {
      try {
        const r = await fetch(`${API_URL}/notificacoes`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) return;
        const j = await r.json();
        if (alive) setTotal(j.naoLidas ?? 0);
      } catch {
        /* A central de notificações mostra o erro detalhado. */
      }
    }
    void atualizar();
    const timer = setInterval(() => void atualizar(), 30000);
    const onFocus = () => void atualizar();
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [token]);

  const pendentes = total !== null && total > 0;
  return (
    <Link
      href="/notificacoes"
      className="app-topbar__avisos"
      aria-label={pendentes ? `Notificações, ${total} não lidas` : "Notificações"}
    >
      🔔{pendentes ? ` ${total}` : ""}
    </Link>
  );
}
