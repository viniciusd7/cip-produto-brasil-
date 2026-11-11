"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@cip/ui";
import { API_URL } from "@/lib/api";
import { secretariaLabel } from "@/lib/secretaria-label";

type Secretaria = { id: string; nome: string; sigla?: string | null; titularNome?: string | null };

export function PlanejamentoForm({ token }: { token: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [secretarias, setSecretarias] = useState<Secretaria[]>([]);

  async function loadSecretarias() {
    if (secretarias.length) return;
    const res = await fetch(`${API_URL}/admin/secretarias`, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    setSecretarias(json.data || []);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const plan = { nome: String(form.get("planoNome")), periodo: String(form.get("periodo") || ""), descricao: String(form.get("planoDescricao") || "") };
    const planRes = await fetch(`${API_URL}/planejamento/planos`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(plan) });
    const planJson = await planRes.json();
    if (!planRes.ok) { setError(planJson?.error?.message || "Não foi possível salvar o plano."); setSaving(false); return; }
    const metaName = String(form.get("metaNome") || "").trim();
    if (metaName) {
      const metaRes = await fetch(`${API_URL}/planejamento/metas`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({
        planoId: planJson.data.id,
        nome: metaName,
        codigo: String(form.get("metaCodigo") || "") || undefined,
        secretariaId: String(form.get("secretariaId") || "") || undefined,
        descricao: String(form.get("metaDescricao") || "") || undefined,
        perspectivaBsc: String(form.get("perspectivaBsc") || "") || undefined,
        resultadoChaveOkr: String(form.get("resultadoChaveOkr") || "") || undefined,
      }) });
      const metaJson = await metaRes.json();
      if (!metaRes.ok) { setError(metaJson?.error?.message || "Plano salvo, mas a meta não foi criada."); setSaving(false); router.refresh(); return; }
    }
    event.currentTarget.reset();
    setOpen(false);
    setSaving(false);
    router.refresh();
  }

  if (!open) return <Button onClick={() => { setOpen(true); void loadSecretarias(); }}>+ Novo plano de governo</Button>;

  return (
    <Card title="Novo plano de governo" subtitle="O cadastro pode começar apenas com o plano; a meta é opcional nesta etapa.">
      <form onSubmit={submit} className="stack">
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
          <div><label htmlFor="planoNome">Nome do plano</label><input id="planoNome" name="planoNome" required placeholder="Plano de governo 2025–2028" /></div>
          <div><label htmlFor="periodo">Período</label><input id="periodo" name="periodo" placeholder="2025–2028" /></div>
        </div>
        <div><label htmlFor="planoDescricao">Descrição</label><textarea id="planoDescricao" name="planoDescricao" rows={2} placeholder="Diretrizes e contexto do mandato" /></div>
        <div style={{ borderTop: "1px solid var(--cip-border)", paddingTop: 16 }}><strong>Primeira meta estratégica (opcional)</strong></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
          <div><label htmlFor="metaCodigo">Código</label><input id="metaCodigo" name="metaCodigo" placeholder="EIXO-01" /></div>
          <div><label htmlFor="metaNome">Nome da meta</label><input id="metaNome" name="metaNome" placeholder="Ampliar a atenção básica" /></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><label htmlFor="secretariaId">Unidade responsável</label><select id="secretariaId" name="secretariaId"><option value="">A definir</option>{secretarias.map((s) => <option key={s.id} value={s.id}>{secretariaLabel(s)}</option>)}</select></div>
          <div><label htmlFor="metaDescricao">Descrição da meta</label><input id="metaDescricao" name="metaDescricao" placeholder="Resultado estratégico esperado" /></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
          <div>
            <label htmlFor="perspectivaBsc">Perspectiva BSC</label>
            <select id="perspectivaBsc" name="perspectivaBsc">
              <option value="">—</option>
              <option value="FINANCEIRA">Financeira</option>
              <option value="CLIENTES">Cidadãos / clientes</option>
              <option value="PROCESSOS">Processos</option>
              <option value="APRENDIZADO">Aprendizado</option>
            </select>
          </div>
          <p className="dashboard-muted" style={{ alignSelf: "end", margin: 0 }}>Indicadores, responsável e sugestões da IA são adicionados no cartão da meta depois de salvar.</p>
        </div>
        <div><label htmlFor="resultadoChaveOkr">Resultado-chave (OKR)</label><input id="resultadoChaveOkr" name="resultadoChaveOkr" placeholder="KR mensurável do mandato" /></div>
        {error && <p style={{ color: "var(--cip-danger)", margin: 0 }}>{error}</p>}
        <div className="chip-row"><Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar estrutura"}</Button><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button></div>
      </form>
    </Card>
  );
}
