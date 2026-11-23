"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ApiError, apiFetch } from "@/lib/api";
import { criarEnvioId } from "@/lib/comunicacao";
import "./comunicacao.css";

type Mensagem = {
  id: string; texto: string; tipo: string; createdAt: string; recebida: boolean;
  autor?: { id: string; name: string } | null;
  destinatario?: { id: string; name: string } | null;
  leituras: Array<{ lidoEm: string }>;
  iniciativa: { id: string; nome: string; secretariaPrincipal: { nome: string } };
};
type Destino = { id: string; name: string; roles: Array<{ role: { name: string } }> };
type Pagina = { data: Mensagem[]; projeto: { nome: string; codigo: string } | null; canRespond: boolean; nextCursor: string | null };
const dataBr = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

export function ComunicacaoProjeto({ token, iniciativaId }: { token: string; iniciativaId: string }) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [projeto, setProjeto] = useState<Pagina["projeto"]>(null);
  const [destinos, setDestinos] = useState<Destino[]>([]);
  const [canRespond, setCanRespond] = useState(false);
  const [destinatarioId, setDestinatarioId] = useState("");
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [busy, setBusy] = useState(false);
  const [maisBusy, setMaisBusy] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const maisCarregadas = useRef(false);
  const campo = useRef<HTMLTextAreaElement>(null);
  const envio = useRef<{ assinatura: string; id: string } | null>(null);

  const carregar = useCallback(async (cursor?: string, signal?: AbortSignal) => {
    try {
      const query = new URLSearchParams({ iniciativaId });
      if (cursor) query.set("cursor", cursor);
      const pagina = await apiFetch<Pagina>(`/comunicados?${query}`, { token, signal });
      if (signal?.aborted) return;
      setMensagens((anteriores) => {
        const mapa = new Map((maisCarregadas.current || cursor ? anteriores : []).map((m) => [m.id, m]));
        for (const mensagem of pagina.data) mapa.set(mensagem.id, mensagem);
        return [...mapa.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
      });
      setCanRespond(pagina.canRespond);
      setProjeto(pagina.projeto);
      if (cursor || !maisCarregadas.current) setNextCursor(pagina.nextCursor);
      if (cursor) maisCarregadas.current = true;
      setErro("");
    } catch (e) {
      if (signal?.aborted) return;
      setErro(e instanceof Error ? e.message : "Falha ao carregar a conversa");
      if (e instanceof ApiError && [401, 403, 404].includes(e.status)) {
        setMensagens([]); setDestinos([]); setCanRespond(false); setProjeto(null);
      }
    } finally {
      if (!signal?.aborted) { setCarregando(false); setMaisBusy(false); }
    }
  }, [token, iniciativaId]);

  useEffect(() => {
    const controller = new AbortController();
    const inicial = setTimeout(() => void carregar(undefined, controller.signal), 0);
    const timer = setInterval(() => void carregar(undefined, controller.signal), 30000);
    return () => { controller.abort(); clearTimeout(inicial); clearInterval(timer); };
  }, [carregar]);

  useEffect(() => {
    if (!canRespond) return;
    const controller = new AbortController();
    apiFetch<{ data: Destino[] }>(`/comunicados/destinatarios?iniciativaId=${encodeURIComponent(iniciativaId)}`, { token, signal: controller.signal })
      .then((j) => { if (!controller.signal.aborted) setDestinos(j.data); })
      .catch((e) => { if (!controller.signal.aborted) setErro(e instanceof Error ? e.message : "Falha ao carregar destinatários"); });
    return () => controller.abort();
  }, [token, canRespond, iniciativaId]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setErro(""); setSucesso("");
    const assinatura = JSON.stringify({ iniciativaId, destinatarioId, texto: texto.trim() });
    try {
      if (envio.current?.assinatura !== assinatura) envio.current = { assinatura, id: criarEnvioId() };
      await apiFetch("/comunicados", { token, method: "POST", body: JSON.stringify({ iniciativaId, destinatarioId, texto, envioId: envio.current.id }) });
      setTexto(""); envio.current = null;
      setSucesso("Mensagem enviada. O destinatário recebeu um aviso interno.");
      window.dispatchEvent(new Event("cip:avisos-atualizados"));
      await carregar();
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha ao enviar"); }
    finally { setBusy(false); }
  }

  async function ler(id: string) {
    try {
      await apiFetch(`/comunicados/${encodeURIComponent(id)}/lido`, { token, method: "POST" });
      window.dispatchEvent(new Event("cip:avisos-atualizados"));
      await carregar();
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível confirmar a leitura"); }
  }

  return <section className="cp stack" aria-label="Conversa do projeto">
    <div className="cp-cabecalho">
      <div><h2>{projeto ? `${projeto.codigo} · ${projeto.nome}` : "Conversa do projeto"}</h2><p className="dashboard-muted">Orientações, dúvidas e respostas da equipe, com histórico e autoria.</p></div>
      <Link href={`/comunicados?projeto=${encodeURIComponent(iniciativaId)}`}>Abrir na central</Link>
    </div>
    <p className="cp-contexto">As mensagens são visíveis a todos com acesso a este projeto. A pessoa selecionada recebe o aviso. Uma mensagem não cria tarefa nem altera prazos.</p>
    {erro && <p role="alert" className="cp-erro">{erro} <button type="button" onClick={() => void carregar()}>Tentar novamente</button></p>}
    {carregando ? <p role="status">Carregando conversa…</p> : <>
      {nextCursor && <button type="button" className="cip-btn cip-btn--secondary" disabled={maisBusy} onClick={() => { setMaisBusy(true); void carregar(nextCursor); }}>{maisBusy ? "Carregando…" : "Carregar mensagens anteriores"}</button>}
      {!mensagens.length && !erro && <p className="cp-vazio">Nenhuma mensagem neste projeto. Use a conversa para alinhar o trabalho com a equipe.</p>}
      <ol className="cp-mensagens">
        {mensagens.map((m) => <li key={m.id} className={`cp-mensagem${m.recebida && !m.leituras.length ? " cp-mensagem--nova" : ""}`}>
          <div className="cp-mensagem__topo"><strong>{m.autor?.name || "Sistema CIP"}</strong><time dateTime={m.createdAt}>{dataBr(m.createdAt)}</time></div>
          <p className="dashboard-muted">Aviso para {m.destinatario?.name || "secretários com acesso ao projeto"}{m.recebida && !m.leituras.length ? " · Não lida" : ""}</p>
          <p className="cp-texto">{m.texto}</p>
          <div className="cp-acoes">
            {canRespond && m.autor && destinos.some((d) => d.id === m.autor?.id) && <button type="button" onClick={() => { setDestinatarioId(m.autor!.id); campo.current?.focus(); }}>Responder a {m.autor.name}</button>}
            {m.recebida && (m.leituras.length ? <span>Leitura registrada</span> : <button type="button" onClick={() => void ler(m.id)}>Marcar como lida</button>)}
          </div>
        </li>)}
      </ol>
      {canRespond ? <form className="cp-form stack" onSubmit={enviar}>
        <h3>Enviar mensagem</h3>
        <label>Quem deve receber o aviso?<select required disabled={busy} value={destinatarioId} onChange={(e) => setDestinatarioId(e.target.value)}><option value="">Selecione uma pessoa do projeto</option>{destinos.map((d) => <option key={d.id} value={d.id}>{d.name} · {d.roles.map((r) => r.role.name).join(", ")}</option>)}</select></label>
        {!destinos.length && <p className="dashboard-muted">Nenhum outro usuário ativo com acesso ao projeto está disponível. A consultoria pode conferir os vínculos na gestão de equipe.</p>}
        <label>Mensagem<textarea ref={campo} required minLength={3} maxLength={5000} disabled={busy} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Registre a orientação, dúvida ou atualização sobre o projeto." /></label>
        <div className="cp-acoes"><span className="dashboard-muted">{texto.length}/5000 caracteres · Atualização a cada 30 segundos</span><button className="cip-btn cip-btn--primary" disabled={busy || !destinatarioId}>{busy ? "Enviando…" : "Enviar mensagem"}</button></div>
      </form> : <p className="cp-contexto">Seu perfil permite acompanhar esta conversa em consulta.</p>}
      {sucesso && <p role="status">{sucesso}</p>}
    </>}
  </section>;
}
