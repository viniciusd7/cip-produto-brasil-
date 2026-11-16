"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@cip/ui";
import { apiFetch } from "@/lib/api";

export function PlanejamentoForm({ token }: { token: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const element = event.currentTarget;
    const form = new FormData(element);
    const plan = { nome: String(form.get("planoNome")), periodo: String(form.get("periodo") || ""), descricao: String(form.get("planoDescricao") || "") };
    try {
      await apiFetch("/planejamento/planos", { token, method: "POST", body: JSON.stringify(plan) });
      element.reset();
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar o plano.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return <Button onClick={() => setOpen(true)}>+ Novo plano de governo</Button>;

  return (
    <Card title="Novo plano de governo" subtitle="Cadastre o plano aqui. Metas estratégicas são criadas dentro de um projeto ou no assistente de novo projeto.">
      <form onSubmit={submit} className="stack">
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
          <div><label htmlFor="planoNome">Nome do plano</label><input id="planoNome" name="planoNome" required placeholder="Plano de governo 2025–2028" /></div>
          <div><label htmlFor="periodo">Período</label><input id="periodo" name="periodo" placeholder="2025–2028" /></div>
        </div>
        <div><label htmlFor="planoDescricao">Descrição</label><textarea id="planoDescricao" name="planoDescricao" rows={2} placeholder="Diretrizes e contexto do mandato" /></div>
        {error && <p role="alert" style={{ color: "var(--cip-danger)", margin: 0 }}>{error}</p>}
        <div className="chip-row"><Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar estrutura"}</Button><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button></div>
      </form>
    </Card>
  );
}
