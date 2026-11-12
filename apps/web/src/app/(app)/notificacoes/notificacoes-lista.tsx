"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import "./notificacoes.css";

type Notificacao = {
  id: string;
  tipo: string;
  titulo: string;
  texto: string;
  link?: string | null;
  lidaEm?: string | null;
  createdAt: string;
};

const TIPOS: Record<string, { label: string; plural: string; icone: string; cor: string; acao: string }> = {
  ATRIBUICAO: { label: "Atribuição", plural: "Atribuídas a você", icone: "📌", cor: "#7c9cff", acao: "Ver tarefa" },
  VALIDACAO_PENDENTE: { label: "Aguardando validação", plural: "Para validar", icone: "⏳", cor: "#eac78c", acao: "Validar agora" },
  VALIDACAO_DECIDIDA: { label: "Decisão da consultoria", plural: "Decisões", icone: "✅", cor: "#b4e4a0", acao: "Ver decisão" },
  REPROGRAMACAO: { label: "Prazo reprogramado", plural: "Prazos alterados", icone: "📅", cor: "#b9a0ff", acao: "Ver prazo" },
};
const OUTRO = { label: "Aviso", plural: "Avisos", icone: "🔔", cor: "#929bb4", acao: "Abrir" };

const DIA = 86400000;
const fmtHora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const fmtData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

function grupoDoDia(iso: string, hoje0: number) {
  const t = new Date(iso).getTime();
  if (t >= hoje0) return "Hoje";
  if (t >= hoje0 - DIA) return "Ontem";
  if (t >= hoje0 - 6 * DIA) return "Nesta semana";
  return "Anteriores";
}

export function NotificacoesLista({ token }: { token: string }) {
  const [itens, setItens] = useState<Notificacao[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [status, setStatus] = useState<"nao-lidas" | "todas">("nao-lidas");
  const [tipo, setTipo] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [hoje0] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  });

  const carregar = useCallback(async () => {
    try {
      const r = await apiFetch<{ data: Notificacao[]; naoLidas: number }>("/notificacoes", { token });
      setItens(r.data);
      setNaoLidas(r.naoLidas);
      setErro("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar notificações.");
    } finally {
      setCarregando(false);
    }
  }, [token]);

  useEffect(() => {
    let ativo = true;
    apiFetch<{ data: Notificacao[]; naoLidas: number }>("/notificacoes", { token })
      .then((r) => {
        if (!ativo) return;
        setItens(r.data);
        setNaoLidas(r.naoLidas);
        if (!r.naoLidas) setStatus("todas");
      })
      .catch((e) => {
        if (ativo) setErro(e instanceof Error ? e.message : "Falha ao carregar notificações.");
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [token]);

  async function marcar(id: string) {
    setItens((lista) => lista.map((n) => (n.id === id ? { ...n, lidaEm: new Date().toISOString() } : n)));
    setNaoLidas((n) => Math.max(0, n - 1));
    await apiFetch(`/notificacoes/${id}/lida`, { token, method: "POST" }).catch(() => null);
    void carregar();
  }

  async function marcarTodas() {
    await apiFetch("/notificacoes/lidas", { token, method: "POST" }).catch(() => null);
    void carregar();
  }

  const base = status === "nao-lidas" ? itens.filter((n) => !n.lidaEm) : itens;
  const visiveis = tipo ? base.filter((n) => n.tipo === tipo) : base;
  const contagem = (t: string) => base.filter((n) => n.tipo === t).length;

  const grupos: Array<{ nome: string; itens: Notificacao[] }> = [];
  for (const n of visiveis) {
    const nome = grupoDoDia(n.createdAt, hoje0);
    const g = grupos.find((x) => x.nome === nome);
    if (g) g.itens.push(n);
    else grupos.push({ nome, itens: [n] });
  }

  return (
    <div className="nt">
      <section className="nt-topo" aria-live="polite">
        <div className={`nt-sino${naoLidas ? " is-on" : ""}`} aria-hidden="true">
          🔔{naoLidas > 0 && <b>{naoLidas}</b>}
        </div>
        <div>
          <h2>{naoLidas ? `Você tem ${naoLidas} aviso${naoLidas === 1 ? "" : "s"} novo${naoLidas === 1 ? "" : "s"}` : "Tudo em dia por aqui"}</h2>
          <p>Toque em um aviso para ir direto à tarefa, meta ou validação.</p>
        </div>
        <div className="nt-topo__acoes">
          <div className="nt-seg" role="group" aria-label="Mostrar">
            {(["nao-lidas", "todas"] as const).map((f) => (
              <button key={f} type="button" aria-pressed={status === f} onClick={() => setStatus(f)}>
                {f === "todas" ? "Todas" : "Não lidas"}
              </button>
            ))}
          </div>
          {naoLidas > 0 && (
            <button type="button" className="nt-btn nt-btn--ghost" onClick={() => void marcarTodas()}>
              ✓ Marcar todas como lidas
            </button>
          )}
        </div>
      </section>

      <div className="nt-resumo" role="group" aria-label="Filtrar por tipo">
        {Object.entries(TIPOS).map(([k, t]) => (
          <button
            key={k}
            type="button"
            className="nt-resumo__item"
            aria-pressed={tipo === k}
            style={{ ["--c" as string]: t.cor }}
            onClick={() => setTipo((atual) => (atual === k ? "" : k))}
          >
            <span aria-hidden="true">{t.icone}</span>
            <b>{contagem(k)}</b>
            <small>{t.plural}</small>
          </button>
        ))}
      </div>

      {erro && <p role="alert" className="nt-erro">{erro}</p>}

      {carregando ? (
        <p className="dashboard-muted">Carregando avisos…</p>
      ) : visiveis.length === 0 ? (
        <div className="nt-vazio">
          <span aria-hidden="true">🎉</span>
          <strong>{status === "nao-lidas" ? "Nenhum aviso pendente" : "Nenhum aviso por aqui"}</strong>
          <p>
            {tipo
              ? "Não há avisos deste tipo. Limpe o filtro para ver os demais."
              : "Quando uma tarefa for atribuída a você, ou uma evidência precisar de validação, o aviso aparece aqui."}
          </p>
          {(tipo || status === "nao-lidas") && itens.length > 0 && (
            <button type="button" className="nt-btn nt-btn--ghost" onClick={() => { setTipo(""); setStatus("todas"); }}>
              Ver todos os avisos
            </button>
          )}
        </div>
      ) : (
        grupos.map((g) => (
          <section key={g.nome} className="nt-grupo" aria-label={g.nome}>
            <h3>{g.nome}</h3>
            <ul>
              {g.itens.map((n) => {
                const t = TIPOS[n.tipo] || OUTRO;
                const data = new Date(n.createdAt);
                return (
                  <li key={n.id} className={`nt-item${n.lidaEm ? "" : " is-nova"}`} style={{ ["--c" as string]: t.cor }}>
                    <span className="nt-item__icone" aria-hidden="true">{t.icone}</span>
                    <div className="nt-item__corpo">
                      <p className="nt-item__tipo">
                        {t.label}
                        {!n.lidaEm && <span className="nt-item__nova">Nova</span>}
                      </p>
                      <strong>{n.titulo}</strong>
                      <p className="nt-item__texto">{n.texto}</p>
                    </div>
                    <div className="nt-item__lado">
                      <time dateTime={n.createdAt}>
                        {g.nome === "Hoje" || g.nome === "Ontem" ? fmtHora.format(data) : fmtData.format(data)}
                      </time>
                      <div className="nt-item__acoes">
                        {n.link && (
                          <Link className="nt-btn" href={n.link} onClick={() => !n.lidaEm && void marcar(n.id)}>
                            {t.acao} →
                          </Link>
                        )}
                        {!n.lidaEm && (
                          <button type="button" className="nt-btn nt-btn--ghost" onClick={() => void marcar(n.id)} aria-label={`Marcar "${n.titulo}" como lida`}>
                            ✓
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      <aside className="nt-canais">
        <span aria-hidden="true">📡</span>
        <p>
          <strong>Canais de aviso:</strong> 🖥️ Painel <em>(ativo)</em> · ✉️ E-mail <em>(em breve)</em> · 💬 WhatsApp oficial <em>(em breve)</em>.
          Os mesmos avisos desta central serão enviados por esses canais.
        </p>
      </aside>
    </div>
  );
}
