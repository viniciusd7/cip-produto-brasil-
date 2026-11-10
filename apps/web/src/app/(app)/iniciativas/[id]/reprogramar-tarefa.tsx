"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api";
export function ReprogramarTarefa({ token, marcoId, prazo, historico, canWrite = true }: { canWrite?: boolean; token: string; marcoId: string; prazo?: string | null; historico: Array<{ id: string; motivo: string; dataNova?: string; dataAnterior?: string | null }> }) {
  const router = useRouter();
  const [dataNova, setDataNova] = useState(""); const [motivo, setMotivo] = useState(""); const [erro, setErro] = useState(""); const [busy, setBusy] = useState(false);
  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErro("");
    try {
      const r = await fetch(`${API_URL}/iniciativas/marcos/${marcoId}/${prazo ? "reprogramar" : "prazo-inicial"}`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ dataNova: `${dataNova}T23:59:59.000-03:00`, motivo }) });
      const j = await r.json(); if (!r.ok) throw new Error(j?.error?.message || "Falha ao reprogramar");
      setDataNova(""); setMotivo(""); router.refresh();
    } catch (e) { setErro((e as Error).message); } finally { setBusy(false); }
  }
  return <details className="more-block"><summary>{canWrite ? prazo ? "Reprogramar prazo e consultar histórico" : "Definir prazo da tarefa" : "Histórico dos prazos"}</summary>
    {canWrite && <form onSubmit={salvar} className="stack"><p>Prazo atual: {prazo ? new Date(prazo).toLocaleDateString("pt-BR") : "a definir"}. O prazo original permanece registrado e o secretário recebe um aviso interno.</p>
      <label>Nova data de entrega<input type="date" required value={dataNova} onChange={(e) => setDataNova(e.target.value)} /></label>
      {prazo && <label>Motivo e providência para cumprir a nova data<textarea required minLength={5} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label>}
      <button className="cip-btn cip-btn--secondary" disabled={busy}>{busy ? "Salvando…" : prazo ? "Confirmar reprogramação" : "Salvar prazo inicial"}</button>
      {erro && <p role="alert">{erro}</p>}
    </form>}
    {historico.map((h) => <p key={h.id}>{h.dataAnterior ? new Date(h.dataAnterior).toLocaleDateString("pt-BR") : "Sem prazo"} → {h.dataNova ? new Date(h.dataNova).toLocaleDateString("pt-BR") : "—"}: {h.motivo}</p>)}
  </details>;
}
