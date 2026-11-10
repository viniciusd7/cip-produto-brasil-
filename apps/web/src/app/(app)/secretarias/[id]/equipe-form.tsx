"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button } from "@cip/ui";
import { API_URL } from "@/lib/api";

export type PessoaPasta = {
  id: string;
  nome: string;
  cargo: string;
  telefone?: string | null;
  email?: string | null;
  papel: string;
};

export function EquipeLista({
  pessoas,
  canWrite,
  token,
  secretariaId,
}: {
  pessoas: PessoaPasta[];
  canWrite: boolean;
  token: string;
  secretariaId: string;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function inativar(pessoaId: string) {
    setBusyId(pessoaId);
    await fetch(
      `${API_URL}/admin/secretarias/${secretariaId}/pessoas/${pessoaId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ativo: false }),
      },
    );
    setBusyId(null);
    router.refresh();
  }

  async function tornarTitular(pessoaId: string) {
    setBusyId(pessoaId);
    await fetch(
      `${API_URL}/admin/secretarias/${secretariaId}/pessoas/${pessoaId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ papel: "TITULAR" }),
      },
    );
    setBusyId(null);
    router.refresh();
  }

  if (!pessoas.length) {
    return <p className="dashboard-muted">Nenhum funcionário cadastrado nesta pasta.</p>;
  }

  return (
    <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {pessoas.map((p) => (
        <li
          key={p.id}
          className="entity-card"
          style={{
            marginBottom: 8,
            borderColor:
              p.papel === "TITULAR" ? "var(--cip-blue)" : undefined,
          }}
        >
          <div className="entity-card__top">
            <strong>
              {p.nome}
              <span className="dashboard-muted"> · {p.cargo}</span>
            </strong>
            <Badge tone={p.papel === "TITULAR" ? "info" : "neutral"}>
              {p.papel === "TITULAR" ? "Titular" : "Equipe"}
            </Badge>
          </div>
          <div className="dashboard-muted" style={{ marginTop: 4 }}>
            {[p.telefone, p.email].filter(Boolean).join(" · ") || "Sem contato"}
          </div>
          {canWrite && (
            <div className="chip-row" style={{ marginTop: 8 }}>
              {p.papel !== "TITULAR" && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busyId === p.id}
                  onClick={() => tornarTitular(p.id)}
                >
                  Tornar titular
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                disabled={busyId === p.id}
                onClick={() => inativar(p.id)}
              >
                Remover
              </Button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export function EquipeAddForm({
  token,
  secretariaId,
}: {
  token: string;
  secretariaId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch(
      `${API_URL}/admin/secretarias/${secretariaId}/pessoas`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nome: String(form.get("nome") || ""),
          cargo: String(form.get("cargo") || ""),
          telefone: String(form.get("telefone") || "") || null,
          email: String(form.get("email") || "") || null,
          papel: String(form.get("papel") || "EQUIPE"),
        }),
      },
    );
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(json?.error?.message || "Não foi possível adicionar.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <Button type="button" variant="ghost" onClick={() => setOpen(true)}>
        + Adicionar funcionário
      </Button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="stack">
      <div className="form-grid form-grid--2">
        <div>
          <label htmlFor="eq-nome">Nome</label>
          <input id="eq-nome" name="nome" required placeholder="Nome completo" />
        </div>
        <div>
          <label htmlFor="eq-cargo">Cargo</label>
          <input
            id="eq-cargo"
            name="cargo"
            required
            placeholder="Ex.: Coordenador de obras"
          />
        </div>
        <div>
          <label htmlFor="eq-tel">Telefone</label>
          <input id="eq-tel" name="telefone" placeholder="(31) 90000-0000" />
        </div>
        <div>
          <label htmlFor="eq-email">E-mail</label>
          <input
            id="eq-email"
            name="email"
            type="email"
            placeholder="nome@prefeitura.gov.br"
          />
        </div>
        <div>
          <label htmlFor="eq-papel">Papel</label>
          <select id="eq-papel" name="papel" defaultValue="EQUIPE">
            <option value="EQUIPE">Equipe</option>
            <option value="TITULAR">Titular da pasta</option>
          </select>
        </div>
      </div>
      {error && <p style={{ color: "var(--cip-danger)", margin: 0 }}>{error}</p>}
      <div className="chip-row">
        <Button type="submit" disabled={saving}>
          {saving ? "Salvando..." : "Salvar funcionário"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
