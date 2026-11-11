"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@cip/ui";
import { API_URL } from "@/lib/api";

type SecretariaOption = { id: string; nome: string; sigla?: string | null };

export function SecretariaAssignment({
  userId,
  initialId,
  isSecretary,
  secretarias,
  token,
}: {
  userId: string;
  initialId: string | null;
  isSecretary: boolean;
  secretarias: SecretariaOption[];
  token: string;
}) {
  const router = useRouter();
  const [secretariaId, setSecretariaId] = useState(initialId || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  if (!isSecretary) return <span>—</span>;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(
        `${API_URL}/admin/usuarios/${userId}/secretaria`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ secretariaId }),
        },
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          result?.error?.message || "Não foi possível vincular a secretaria.",
        );
      }
      setMessage("Vínculo salvo.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Não foi possível salvar.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="chip-row">
      <label className="sr-only" htmlFor={`secretaria-${userId}`}>
        Secretaria vinculada
      </label>
      <select
        id={`secretaria-${userId}`}
        value={secretariaId}
        onChange={(event) => setSecretariaId(event.target.value)}
        required
      >
        <option value="" disabled>
          Selecione
        </option>
        {secretarias.map((secretaria) => (
          <option key={secretaria.id} value={secretaria.id}>
            {secretaria.sigla
              ? `${secretaria.nome} (${secretaria.sigla})`
              : secretaria.nome}
          </option>
        ))}
      </select>
      <Button type="submit" variant="secondary" disabled={saving || !secretariaId}>
        {saving ? "Salvando..." : "Salvar"}
      </Button>
      {message && <small role="status">{message}</small>}
    </form>
  );
}
