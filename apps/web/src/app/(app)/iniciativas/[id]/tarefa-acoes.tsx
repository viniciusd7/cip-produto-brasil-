"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@cip/ui";
import { API_URL } from "@/lib/api";

/** Concluir / reabrir tarefa — paridade com cip-projeto (ficha-tarefas). */
export function TarefaAcoes({
  token,
  marcoId,
  concluidoEm,
  canWrite,
}: {
  token: string;
  marcoId: string;
  concluidoEm?: string | null;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  if (!canWrite) return null;

  const concluida = Boolean(concluidoEm);
  const action = concluida ? "reabrir" : "concluir";
  const label = concluida ? "Reabrir" : "Concluir";

  async function run() {
    setLoading(true);
    setErro("");
    try {
      const res = await fetch(`${API_URL}/iniciativas/marcos/${marcoId}/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || `Falha ao ${action}`);
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="chip-row" style={{ alignItems: "center" }}>
      <Button type="button" variant="secondary" disabled={loading} onClick={run}>
        {loading ? "..." : label}
      </Button>
      {erro && <span style={{ color: "var(--cip-danger)", fontSize: 13 }}>{erro}</span>}
    </span>
  );
}

/** Toggle de conclusão de subtarefa via PATCH. */
export function SubtarefaToggle({
  token,
  subtarefaId,
  concluida,
  canWrite,
}: {
  token: string;
  subtarefaId: string;
  concluida: boolean;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (!canWrite) {
    return <span aria-hidden>{concluida ? "✓" : "○"}</span>;
  }

  async function toggle() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/iniciativas/subtarefas/${subtarefaId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ concluida: !concluida }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json?.error?.message || "Falha ao atualizar");
      }
      router.refresh();
    } catch {
      /* mantém estado atual; refresh não ocorre */
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      className="linkish"
      disabled={loading}
      onClick={toggle}
      aria-pressed={concluida}
      aria-label={concluida ? "Marcar subtarefa como aberta" : "Marcar subtarefa como concluída"}
      title={concluida ? "Marcar como aberta" : "Marcar como concluída"}
    >
      {loading ? "…" : concluida ? "✓" : "○"}
    </button>
  );
}
