"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { linkInternoAviso } from "@/lib/comunicacao";
import "./notificacoes.css";

type Notificacao = {
  id: string; origem: "comunicado" | "notificacao"; tipo: string;
  titulo: string; texto: string; link?: string | null;
  lidaEm?: string | null; createdAt: string;
};
type Pagina = { data: Notificacao[]; naoLidas: number; nextCursor: string | null };
const TIPOS: Record<string, { label: string; icone: string; cor: string; acao: string }> = {
  MENSAGEM: { label: "Mensagem do projeto", icone: "💬", cor: "#7c9cff", acao: "Abrir conversa" },
  ATRIBUICAO: { label: "Atribuição", icone: "📌", cor: "#7c9cff", acao: "Ver atribuição" },
  VALIDACAO_PENDENTE: { label: "Aguardando validação", icone: "⏳", cor: "#eac78c", acao: "Ver validação" },
  VALIDACAO_DECIDIDA: { label: "Decisão da consultoria", icone: "✅", cor: "#b4e4a0", acao: "Ver decisão" },
  REPROGRAMACAO: { label: "Prazo reprogramado", icone: "📅", cor: "#b9a0ff", acao: "Ver prazo" },
};
const OUTRO = { label: "Aviso do projeto", icone: "🔔", cor: "#929bb4", acao: "Abrir origem" };
const chave = (n: Notificacao) => `${n.origem}:${n.id}`;

function ListaAvisos({ token, status }: { token: string; status: "nao-lidas" | "todas" }) {
  const [itens, setItens] = useState<Notificacao[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [busy, setBusy] = useState(false);
  const [marcando, setMarcando] = useState<string | null>(null);
  const maisCarregadas = useRef(false);

  const carregar = useCallback(async (proxima?: string, signal?: AbortSignal) => {
    try {
      const query = new URLSearchParams({ naoLidos: status === "nao-lidas" ? "1" : "0" });
      if (proxima) query.set("cursor", proxima);
      const r = await apiFetch<Pagina>(`/comunicados/avisos?${query}`, { token, signal });
      if (signal?.aborted) return;
      setItens((atuais) => {
        const mapa = new Map((maisCarregadas.current || proxima ? atuais : []).map((n) => [chave(n), n]));
        for (const item of r.data) mapa.set(chave(item), item);
        return [...mapa.values()].filter((n) => status === "todas" || !n.lidaEm)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || chave(b).localeCompare(chave(a)));
      });
      if (proxima || !maisCarregadas.current) setCursor(r.nextCursor);
      if (proxima) maisCarregadas.current = true;
      setNaoLidas(r.naoLidas); setErro("");
    } catch (e) {
      if (!signal?.aborted) { setItens([]); setErro(e instanceof Error ? e.message : "Falha ao carregar os avisos"); }
    } finally { if (!signal?.aborted) { setCarregando(false); setBusy(false); } }
  }, [token, status]);

  useEffect(() => {
    const controller = new AbortController();
    const initial = setTimeout(() => void carregar(undefined, controller.signal), 0);
    const timer = setInterval(() => void carregar(undefined, controller.signal), 30000);
    return () => { controller.abort(); clearTimeout(initial); clearInterval(timer); };
  }, [carregar]);

  async function marcar(n: Notificacao) {
    if (marcando) return;
    setMarcando(chave(n));
    try {
      const path = n.origem === "comunicado" ? `/comunicados/${encodeURIComponent(n.id)}/lido` : `/notificacoes/${encodeURIComponent(n.id)}/lida`;
      await apiFetch(path, { token, method: "POST" });
      setItens((atuais) => atuais.map((a) => chave(a) === chave(n) ? { ...a, lidaEm: new Date().toISOString() } : a));
      window.dispatchEvent(new Event("cip:avisos-atualizados"));
      await carregar();
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível registrar a leitura"); }
    finally { setMarcando(null); }
  }

  return <div className="nt stack">
    <section className="nt-topo"><div className={`nt-sino${naoLidas ? " is-on" : ""}`} aria-hidden="true">🔔{naoLidas > 0 && <b>{naoLidas}</b>}</div><div><h2>{naoLidas ? `${naoLidas} aviso${naoLidas === 1 ? "" : "s"} não lido${naoLidas === 1 ? "" : "s"}` : "Seus avisos"}</h2><p>Mensagens recebidas e atualizações de execução, com acesso à origem.</p></div></section>
    <p className="dashboard-muted">Marcar leitura registra sua ciência. Tarefas e decisões continuam com seu andamento próprio. Atualização a cada 30 segundos.</p>
    {erro && <p role="alert" className="nt-erro">{erro} <button type="button" onClick={() => void carregar()}>Tentar novamente</button></p>}
    {carregando ? <p role="status">Carregando avisos…</p> : !itens.length && !erro ? <div className="nt-vazio"><strong>{status === "nao-lidas" ? "Nenhum aviso não lido" : "Nenhum aviso registrado"}</strong><p>Novas mensagens para você, atribuições e atualizações aparecerão aqui.</p></div> : <section className="nt-grupo" aria-label="Lista de avisos"><ul>{itens.map((n) => {
      const tipo = TIPOS[n.tipo] || OUTRO;
      const link = linkInternoAviso(n.link);
      return <li key={chave(n)} className={`nt-item${n.lidaEm ? "" : " is-nova"}`} style={{ ["--c" as string]: tipo.cor }}>
        <span className="nt-item__icone" aria-hidden="true">{tipo.icone}</span>
        <div className="nt-item__corpo"><p className="nt-item__tipo">{tipo.label}{!n.lidaEm && <span className="nt-item__nova">Novo</span>}</p><strong>{n.titulo}</strong><p className="nt-item__texto" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{n.texto}</p></div>
        <div className="nt-item__lado"><time dateTime={n.createdAt}>{new Date(n.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}</time><div className="nt-item__acoes">{link && <Link className="nt-btn" href={link}>{tipo.acao} →</Link>}{!n.lidaEm && <button type="button" className="nt-btn nt-btn--ghost" disabled={marcando !== null} onClick={() => void marcar(n)}>{marcando === chave(n) ? "Registrando…" : "Marcar como lido"}</button>}</div></div>
      </li>;
    })}</ul></section>}
    {cursor && <button type="button" className="cip-btn cip-btn--secondary" disabled={busy} onClick={() => { setBusy(true); void carregar(cursor); }}>{busy ? "Carregando…" : "Carregar mais avisos"}</button>}
  </div>;
}

export function NotificacoesLista({ token }: { token: string }) {
  const [status, setStatus] = useState<"nao-lidas" | "todas">("nao-lidas");
  return <div className="stack"><div className="nt-seg" role="group" aria-label="Filtrar avisos">{(["nao-lidas", "todas"] as const).map((s) => <button key={s} type="button" aria-pressed={status === s} onClick={() => setStatus(s)}>{s === "todas" ? "Todos os avisos" : "Não lidos"}</button>)}</div><ListaAvisos key={`${token}:${status}`} token={token} status={status} /></div>;
}
