"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@cip/ui";
import { API_URL } from "@/lib/api";

/**
 * Edição inline do responsável de uma meta, tarefa ou subtarefa.
 * `endpoint` é o caminho da API (ex.: /iniciativas/marcos/ID).
 */
export function ResponsavelEditor({
  token,
  endpoint,
  value,
  equipe,
  listId,
  canWrite,
}: {
  token: string;
  endpoint: string;
  value?: string | null;
  equipe: string[];
  listId: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(value ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  if (!canWrite) {
    return <span className="dashboard-muted">{value || "Sem responsável"}</span>;
  }

  if (!editando) {
    return (
      <button
        type="button"
        className="linkish"
        onClick={() => {
          setTexto(value ?? "");
          setErro("");
          setEditando(true);
        }}
      >
        {value ? "Alterar responsável" : "Definir responsável"}
      </button>
    );
  }

  async function salvar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ responsavel: texto.trim() }),
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
    <form onSubmit={salvar} className="chip-row" style={{ alignItems: "center" }}>
      <input
        list={listId}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Nome ou equipe"
        autoFocus
      />
      <Button type="submit" disabled={salvando}>
        {salvando ? "Salvando..." : "Salvar"}
      </Button>
      <Button type="button" variant="ghost" onClick={() => setEditando(false)}>
        Cancelar
      </Button>
      {erro && <span style={{ color: "var(--cip-danger)" }}>{erro}</span>}
      {equipe.length > 0 && (
        <datalist id={listId}>
          {equipe.map((nome) => (
            <option key={nome} value={nome} />
          ))}
        </datalist>
      )}
    </form>
  );
}
