"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { ComunicacaoProjeto } from "./comunicacao-projeto";
import { NotificacoesLista } from "@/app/(app)/notificacoes/notificacoes-lista";
import "./comunicacao.css";

type Projeto = { id: string; nome: string; codigo: string; secretariaPrincipal: { nome: string }; comunicados: Array<{ texto: string; createdAt: string }> };

function Conversas({ token }: { token: string }) {
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [busy, setBusy] = useState(true);
  const carregar = useCallback(async (proxima?: string, signal?: AbortSignal) => {
    try {
      const query = new URLSearchParams({ q: filtro });
      if (proxima) query.set("cursor", proxima);
      const r = await apiFetch<{ data: Projeto[]; nextCursor: string | null }>(`/comunicados/projetos?${query}`, { token, signal });
      if (signal?.aborted) return;
      setProjetos((atuais) => proxima ? [...atuais, ...r.data.filter((p) => !atuais.some((a) => a.id === p.id))] : r.data);
      setCursor(r.nextCursor); setErro("");
    } catch (e) { if (!signal?.aborted) { if (!proxima) setProjetos([]); setErro(e instanceof Error ? e.message : "Falha ao carregar projetos"); } }
    finally { if (!signal?.aborted) setBusy(false); }
  }, [token, filtro]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => { setBusy(true); void carregar(undefined, controller.signal); }, 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [carregar]);
  return <section className="stack" aria-label="Conversas por projeto">
    <p className="dashboard-muted">Escolha o projeto para acompanhar o histórico ou conversar com quem tem acesso a ele.</p>
    <form className="cp-busca" onSubmit={(e) => { e.preventDefault(); setFiltro(busca.trim()); }}><label>Buscar projeto<input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou código" maxLength={150} /></label><button type="submit" className="cip-btn cip-btn--secondary">Buscar</button></form>
    {erro && <p role="alert">{erro} <button type="button" onClick={() => void carregar()}>Tentar novamente</button></p>}
    {busy && <p role="status">Carregando projetos…</p>}
    {!busy && !projetos.length && !erro && <p className="cp-vazio">Nenhum projeto disponível{filtro ? " para esta busca" : " no seu escopo"}.</p>}
    <ul className="cp-projetos">{projetos.map((p) => <li key={p.id}><Link href={`/comunicados?projeto=${encodeURIComponent(p.id)}`}><span className="dashboard-muted">{p.codigo} · {p.secretariaPrincipal.nome}</span><strong>{p.nome}</strong><span className="cp-previa">{p.comunicados[0]?.texto || "Iniciar conversa sobre este projeto"}</span><span className="cp-projeto-acao">Abrir conversa →</span></Link></li>)}</ul>
    {cursor && <button type="button" disabled={busy} className="cip-btn cip-btn--secondary" onClick={() => { setBusy(true); void carregar(cursor); }}>Carregar mais projetos</button>}
  </section>;
}

export function CentralComunicacao({ token, aba, projetoId }: { token: string; aba: "conversas" | "avisos"; projetoId?: string }) {
  return <div className="stack">
    <nav className="cp-abas" aria-label="Comunicação"><Link href="/comunicados" aria-current={aba === "conversas" ? "page" : undefined}>Conversas</Link><Link href="/comunicados?aba=avisos" aria-current={aba === "avisos" ? "page" : undefined}>Avisos</Link></nav>
    {aba === "avisos" ? <NotificacoesLista key={token} token={token} /> : projetoId ? <>
      <Link href="/comunicados">← Todos os projetos</Link>
      <ComunicacaoProjeto key={`${token}:${projetoId}`} token={token} iniciativaId={projetoId} />
    </> : <Conversas key={token} token={token} />}
  </div>;
}
