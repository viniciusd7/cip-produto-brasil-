"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@cip/ui";
import { API_URL } from "@/lib/api";

/** Edição inline de texto (descrição) de tarefa ou subtarefa via PATCH. */
export function ItemTextoEditor({
  token,
  endpoint,
  value,
  canWrite,
  field = "descricao",
  label = "Alterar texto",
}: {
  token: string;
  endpoint: string;
  value: string;
  canWrite: boolean;
  field?: string;
  label?: string;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(value);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  if (!canWrite) return null;

  if (!editando) {
    return (
      <button
        type="button"
        className="linkish"
        onClick={() => {
          setTexto(value);
          setErro("");
          setEditando(true);
        }}
      >
        {label}
      </button>
    );
  }

  async function salvar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next = texto.trim();
    if (next.length < 3) {
      setErro("Informe pelo menos 3 caracteres");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ [field]: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Falha ao salvar");
      setEditando(false);
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="stack" style={{ gap: 8, marginTop: 6 }}>
      <input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        required
        minLength={3}
        autoFocus
      />
      <div className="chip-row">
        <Button type="submit" disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setEditando(false)}>
          Cancelar
        </Button>
        {erro && <span style={{ color: "var(--cip-danger)" }}>{erro}</span>}
      </div>
    </form>
  );
}
