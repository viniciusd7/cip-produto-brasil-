"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { API_URL } from "@/lib/api";

type Aviso = { id: string; texto: string; createdAt: string; autor?: { name: string }; destinatario?: { name: string }; destinoPapel?: string; leituras: unknown[]; iniciativa: { id: string; nome: string; secretariaPrincipal: { nome: string } } };
export function ComunicacaoProjeto({ token, iniciativaId, canWrite = false }: { token: string; iniciativaId?: string; canWrite?: boolean }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [destinos, setDestinos] = useState<Array<{ id: string; name: string; roles: Array<{ role: { name: string } }> }>>([]);
  const [destinatarioId, setDestinatarioId] = useState("");
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");
  const [busy, setBusy] = useState(false);
  const carregar = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/comunicados${iniciativaId ? `?iniciativaId=${encodeURIComponent(iniciativaId)}` : "?naoLidos=1"}`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Não foi possível carregar os avisos");
      setAvisos(json.data); setErro("");
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha de conexão"); }
  }, [token, iniciativaId]);
  useEffect(() => { const inicial = setTimeout(() => void carregar(), 0); const timer = setInterval(() => void carregar(), 30000); return () => { clearTimeout(inicial); clearInterval(timer); }; }, [carregar]);
  useEffect(() => {
    if (!canWrite || !iniciativaId) return;
    fetch(`${API_URL}/comunicados/destinatarios`, { headers: { Authorization: `Bearer ${token}` } }).then(async (r) => { if (!r.ok) throw new Error("Falha ao carregar destinatários"); return r.json(); }).then((j) => setDestinos(j.data)).catch((e) => setErro(e.message));
  }, [token, canWrite, iniciativaId]);
  async function enviar(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErro("");
    try {
      const r = await fetch(`${API_URL}/comunicados`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ iniciativaId, destinatarioId, texto }) });
      const j = await r.json(); if (!r.ok) throw new Error(j?.error?.message || "Falha ao enviar");
      setTexto(""); await carregar();
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha ao enviar"); } finally { setBusy(false); }
  }
  async function ler(id: string) {
    try { const r = await fetch(`${API_URL}/comunicados/${id}/lido`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }); if (!r.ok) throw new Error("Não foi possível confirmar a leitura"); await carregar(); } catch (e) { setErro((e as Error).message); }
  }
  return <section className="stack">
    <h2>{iniciativaId ? "Conversa e providências do projeto" : "Avisos não lidos"}</h2>
    <p className="dashboard-muted">Avisos internos, orientações e respostas ficam registrados no projeto. Exibe os 100 registros mais recentes, com atualização automática a cada 30 segundos.</p>
    {canWrite && iniciativaId && <form className="stack" onSubmit={enviar}>
      <label>Para quem?<select required value={destinatarioId} onChange={(e) => setDestinatarioId(e.target.value)}><option value="">Selecione secretário ou integrante da equipe</option>{destinos.map((d) => <option key={d.id} value={d.id}>{d.name} · {d.roles.map((r) => r.role.name).join(", ")}</option>)}</select></label>
      <label>Orientação ou pedido de providência<textarea required minLength={3} maxLength={5000} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Explique o que precisa ser feito, por quem e até quando." /></label>
      <button className="cip-btn cip-btn--primary" disabled={busy}>{busy ? "Enviando…" : "Enviar aviso interno"}</button>
    </form>}
    {erro && <p role="alert">{erro}</p>}
    {!avisos.length && !erro && <p>Nenhum aviso registrado.</p>}
    {avisos.map((a) => <article key={a.id} className="entity-card">
      <strong>{a.iniciativa.nome} · {a.iniciativa.secretariaPrincipal.nome}</strong>
      <p className="dashboard-muted">{a.autor?.name || "Sistema CIP"} → {a.destinatario?.name || "Caixa compartilhada dos secretários"} · {new Date(a.createdAt).toLocaleString("pt-BR")}</p>
      <p style={{ whiteSpace: "pre-wrap" }}>{a.texto}</p>
      {!iniciativaId && <div className="chip-row"><Link href={`/iniciativas/${a.iniciativa.id}?aba=andamento`}>Abrir projeto e responder</Link>{!a.leituras.length ? <button type="button" onClick={() => ler(a.id)}>Marcar como lido</button> : <span>Lido</span>}</div>}
    </article>)}
  </section>;
}
