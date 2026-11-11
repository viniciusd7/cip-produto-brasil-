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
    nome?: string | null;
    sigla?: string | null;
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
        nome: String(form.get("nome") || "").trim() || undefined,
        sigla: String(form.get("sigla") || "").trim().toUpperCase() || null,
        titularNome: String(form.get("titularNome") || "") || null,
        titularCargo: String(form.get("titularCargo") || "") || null,
        titularTelefone: String(form.get("titularTelefone") || "") || null,
        titularEmail: String(form.get("titularEmail") || "") || null,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(json?.error?.message || "Não foi possível salvar a pasta.");
      return;
    }
    setOk(true);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="stack">
      <div className="form-grid form-grid--2">
        <div>
          <label htmlFor="nome">Nome da secretaria</label>
          <input
            id="nome"
            name="nome"
            required
            minLength={3}
            defaultValue={initial.nome || ""}
            placeholder="Ex.: Secretaria de Educação"
          />
        </div>
        <div>
          <label htmlFor="sigla">Sigla</label>
          <input
            id="sigla"
            name="sigla"
            minLength={2}
            maxLength={12}
            defaultValue={initial.sigla || ""}
            placeholder="Ex.: SME"
            style={{ textTransform: "uppercase" }}
          />
        </div>
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
      {ok && <p className="dashboard-muted">Pasta atualizada.</p>}
      <Button type="submit" disabled={saving}>
        {saving ? "Salvando..." : "Salvar pasta"}
      </Button>
    </form>
  );
}
