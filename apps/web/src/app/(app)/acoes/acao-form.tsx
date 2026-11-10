"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@cip/ui";
import { API_URL } from "@/lib/api";

export function AcaoForm({
  token,
  iniciativas,
}: {
  token: string;
  iniciativas: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const iniciativaId = String(form.get("iniciativaId"));
    const res = await fetch(`${API_URL}/iniciativas/${iniciativaId}/marcos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        descricao: String(form.get("descricao")),
        responsavel: String(form.get("responsavel") || "") || undefined,
        prazoOriginal: String(form.get("prazoOriginal") || "")
          ? new Date(`${String(form.get("prazoOriginal"))}T12:00:00`).toISOString()
          : null,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error?.message || "Não foi possível registrar a ação.");
      setSaving(false);
      return;
    }
    event.currentTarget.reset();
    setSaving(false);
    router.refresh();
  }

  return (
    <Card
      title="Registrar tarefa rápida"
      subtitle="3 campos: projeto, o que fazer e prazo."
    >
      {!iniciativas.length ? (
        <p className="dashboard-muted">Nenhum projeto disponível.</p>
      ) : (
        <form onSubmit={submit} className="quick-task-form">
          <div>
            <label htmlFor="iniciativaId">Projeto</label>
            <select
              id="iniciativaId"
              name="iniciativaId"
              required
              defaultValue={iniciativas[0]?.id}
            >
              {iniciativas.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="descricao">O que precisa ser feito?</label>
            <input
              id="descricao"
              name="descricao"
              required
              minLength={3}
              placeholder="Ex.: publicar edital da unidade de saúde"
            />
          </div>
          <div className="form-grid form-grid--2">
            <div>
              <label htmlFor="prazoOriginal">Prazo</label>
              <input id="prazoOriginal" name="prazoOriginal" type="date" />
            </div>
            <div>
              <label htmlFor="responsavel">Quem faz?</label>
              <input
                id="responsavel"
                name="responsavel"
                placeholder="Nome ou equipe"
              />
            </div>
          </div>
          {error && (
            <p style={{ color: "var(--cip-danger)", margin: 0 }}>{error}</p>
          )}
          <Button type="submit" disabled={saving}>
            {saving ? "Registrando..." : "Salvar tarefa"}
          </Button>
        </form>
      )}
    </Card>
  );
}
