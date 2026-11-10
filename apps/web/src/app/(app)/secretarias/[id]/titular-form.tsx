"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@cip/ui";
import { API_URL } from "@/lib/api";

export function TitularForm({
  token,
  secretariaId,
  initial,
}: {
  token: string;
  secretariaId: string;
  initial: {
    titularNome?: string | null;
    titularCargo?: string | null;
    titularTelefone?: string | null;
    titularEmail?: string | null;
  };
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setOk(false);
    const form = new FormData(e.currentTarget);
    const res = await fetch(`${API_URL}/admin/secretarias/${secretariaId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        titularNome: String(form.get("titularNome") || "") || null,
        titularCargo: String(form.get("titularCargo") || "") || null,
        titularTelefone: String(form.get("titularTelefone") || "") || null,
        titularEmail: String(form.get("titularEmail") || "") || null,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(json?.error?.message || "Não foi possível salvar o titular.");
      return;
    }
    setOk(true);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="stack">
      <div className="form-grid form-grid--2">
        <div>
          <label htmlFor="titularNome">Nome do titular</label>
          <input
            id="titularNome"
            name="titularNome"
            defaultValue={initial.titularNome || ""}
            placeholder="Nome completo"
          />
        </div>
        <div>
          <label htmlFor="titularCargo">Cargo</label>
          <input
            id="titularCargo"
            name="titularCargo"
            defaultValue={initial.titularCargo || ""}
            placeholder="Secretário(a) Municipal"
          />
        </div>
        <div>
          <label htmlFor="titularTelefone">Telefone</label>
          <input
            id="titularTelefone"
            name="titularTelefone"
            defaultValue={initial.titularTelefone || ""}
            placeholder="(31) 90000-0000"
          />
        </div>
        <div>
          <label htmlFor="titularEmail">E-mail</label>
          <input
            id="titularEmail"
            name="titularEmail"
            type="email"
            defaultValue={initial.titularEmail || ""}
            placeholder="secretaria@prefeitura.gov.br"
          />
        </div>
      </div>
      {error && <p style={{ color: "var(--cip-danger)", margin: 0 }}>{error}</p>}
      {ok && <p className="dashboard-muted">Titular atualizado.</p>}
      <Button type="submit" disabled={saving}>
        {saving ? "Salvando..." : "Salvar titular"}
      </Button>
    </form>
  );
}
