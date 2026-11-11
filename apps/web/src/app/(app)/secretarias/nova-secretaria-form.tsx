"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@cip/ui";
import { API_URL } from "@/lib/api";

export function NovaSecretariaForm({ token }: { token: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const nome = String(form.get("nome") || "").trim();
    const sigla = String(form.get("sigla") || "").trim().toUpperCase();
    const res = await fetch(`${API_URL}/admin/secretarias`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        nome,
        sigla: sigla || null,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(json?.error?.message || "Não foi possível criar a secretaria.");
      return;
    }
    setOpen(false);
    router.push(`/secretarias/${json.data.id}`);
    router.refresh();
  }

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        + Nova secretaria
      </Button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="stack" style={{ maxWidth: 520 }}>
      <strong>Nova secretaria</strong>
      <div className="form-grid form-grid--2">
        <div>
          <label htmlFor="nova-sec-nome">Nome</label>
          <input
            id="nova-sec-nome"
            name="nome"
            required
            minLength={3}
            placeholder="Ex.: Secretaria de Educação"
            autoFocus
          />
        </div>
        <div>
          <label htmlFor="nova-sec-sigla">Sigla</label>
          <input
            id="nova-sec-sigla"
            name="sigla"
            minLength={2}
            maxLength={12}
            placeholder="Ex.: SME"
            style={{ textTransform: "uppercase" }}
          />
        </div>
      </div>
      {error && <p style={{ color: "var(--cip-danger)", margin: 0 }}>{error}</p>}
      <div className="chip-row">
        <Button type="submit" disabled={saving}>
          {saving ? "Salvando..." : "Criar secretaria"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
