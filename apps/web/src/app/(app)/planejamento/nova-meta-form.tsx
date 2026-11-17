"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@cip/ui";
import { apiFetch } from "@/lib/api";
import { secretariaLabel } from "@/lib/secretaria-label";

export function NovaMetaForm({ planoId, planos = [], token, secretarias }: {
  planoId?: string;
  planos?: Array<{ id: string; nome: string }>;
  token: string;
  secretarias: Array<{ id: string; nome: string; sigla?: string | null }>;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSalvando(true);
    setErro("");
    try {
      await apiFetch("/planejamento/metas", {
        token,
        method: "POST",
        body: JSON.stringify({
          planoId: planoId || String(form.get("planoId")),
          nome: String(form.get("nome")).trim(),
          secretariaId: String(form.get("secretariaId")),
          descricao: String(form.get("descricao") || "").trim(),
          valorBase: String(form.get("valorBase") || "").trim(),
          alvo: String(form.get("alvo") || "").trim(),
          unidade: String(form.get("unidade") || "").trim(),
        }),
      });
      setAberto(false);
      router.refresh();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível cadastrar a meta.");
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) return <Button variant="secondary" onClick={() => setAberto(true)}>+ Nova meta estratégica</Button>;

  return (
    <Card title="Nova meta estratégica">
      <form className="stack" onSubmit={salvar}>
        {!planoId && <label>Plano de governo<select name="planoId" required defaultValue=""><option value="">Selecione o plano</option>{planos.map((plano) => <option key={plano.id} value={plano.id}>{plano.nome}</option>)}</select></label>}
        <label>Nome da meta<input name="nome" required minLength={3} placeholder="Ex.: ampliar o acesso à educação infantil" /></label>
        <label>Secretaria<select name="secretariaId" required defaultValue=""><option value="">Selecione a secretaria</option>{secretarias.map((secretaria) => <option key={secretaria.id} value={secretaria.id}>{secretariaLabel(secretaria)}</option>)}</select></label>
        <label>Descrição<textarea name="descricao" rows={2} /></label>
        <div className="gp-meta__fields">
          <label>Valor base<input name="valorBase" placeholder="Ex.: 100" /></label>
          <label>Alvo<input name="alvo" placeholder="Ex.: 200" /></label>
          <label>Unidade<input name="unidade" placeholder="Ex.: vagas" /></label>
        </div>
        <p className="dashboard-muted">Após salvar, cadastre os indicadores no cartão da meta.</p>
        {erro && <p role="alert">{erro}</p>}
        <div className="chip-row">
          <Button type="submit" disabled={salvando}>{salvando ? "Salvando…" : "Salvar meta"}</Button>
          <Button type="button" variant="secondary" disabled={salvando} onClick={() => setAberto(false)}>Cancelar</Button>
        </div>
      </form>
    </Card>
  );
}
