"use client";

import { useEffect, useMemo, useState } from "react";
import { CadastroTarefaProjeto } from "./arvore-cadastro";
import { EvidenciaEnvio } from "./evidencia-envio";
import { ItemTextoEditor } from "./item-texto-editor";
import { ReprogramarTarefa } from "./reprogramar-tarefa";
import { EditarResponsavel, type ResponsavelOpcao } from "../../minha-pasta/tarefas-edicao";
import { SubtarefaToggle, TarefaAcoes } from "./tarefa-acoes";
import type { EvidenciaItem } from "./evidencia-actions";
import type { ProjetoDocData, ProjetoDocMarco } from "./projeto-documento";

export const STATUS_TAREFA: Record<string, { label: string; cor: string }> = {
  VENCIDO: { label: "Atrasada", cor: "#ff5982" },
  SEM_PRAZO: { label: "Sem prazo", cor: "#eac78c" },
  NO_PRAZO: { label: "No prazo", cor: "#7c9cff" },
  CONCLUIDO: { label: "Concluída", cor: "#b4e4a0" },
  ENCERRADO_SEM_SOLUCAO: { label: "Encerrada", cor: "#929bb4" },
};

export type FiltroTarefaProjeto = "TODAS" | "VENCIDO" | "SEM_PRAZO" | "NO_PRAZO" | "CONCLUIDO" | "VALIDACAO";
type Filtro = FiltroTarefaProjeto;

const FILTROS: Array<{ id: Filtro; label: string; cor?: string }> = [
  { id: "TODAS", label: "Todas" },
  { id: "VENCIDO", label: "Atrasadas", cor: STATUS_TAREFA.VENCIDO.cor },
  { id: "NO_PRAZO", label: "No prazo", cor: STATUS_TAREFA.NO_PRAZO.cor },
  { id: "SEM_PRAZO", label: "Sem prazo", cor: STATUS_TAREFA.SEM_PRAZO.cor },
  { id: "VALIDACAO", label: "Aguardando validação", cor: "#b9a0ff" },
  { id: "CONCLUIDO", label: "Concluídas", cor: STATUS_TAREFA.CONCLUIDO.cor },
];

function fmt(d?: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function statusDe(m: ProjetoDocMarco) {
  return STATUS_TAREFA[m.prazoStatus] ?? { label: m.prazoStatus, cor: "#929bb4" };
}

type Ctx = {
  canWrite: boolean;
  canSubmitEvidence: boolean;
  token: string;
  responsaveis: ResponsavelOpcao[];
  usuarioId: string;
  administrador: boolean;
  iniciativaId: string;
  aguardando: Set<string>;
  evidPorMarco: Map<string, EvidenciaItem[]>;
  onVerEvidencias: (marcoId: string) => void;
};

const EVID_STATUS: Record<string, { label: string; cor: string }> = {
  DECLARADA: { label: "Em validação", cor: "#eac78c" },
  A_VERIFICAR: { label: "Em validação", cor: "#eac78c" },
  VERIFICADA: { label: "Aprovada", cor: "#b4e4a0" },
  REJEITADA: { label: "Devolvida", cor: "#ff5982" },
};
const EVID_ICONE: Record<string, string> = { FOTO: "📷", VIDEO: "🎥", DOCUMENTO: "📄", LINK: "🔗" };

function TarefaLinha({ m, ctx, aberta, alternar }: { m: ProjetoDocMarco; ctx: Ctx; aberta: boolean; alternar: () => void }) {
  const [painel, setPainel] = useState<null | "EVIDENCIA" | "CONCLUSAO">(null);
  const [criandoSubtarefa, setCriandoSubtarefa] = useState(false);
  const st = statusDe(m);
  const subsFeitas = m.subtarefas.filter((s) => s.concluida).length;
  const evid = ctx.evidPorMarco.get(m.id) ?? [];
  const aguardando = ctx.aguardando.has(m.id);
  const encerrada = m.prazoStatus === "CONCLUIDO" || m.prazoStatus === "ENCERRADO_SEM_SOLUCAO";
  const prazo = fmt(m.prazoVigente ?? m.prazoOriginal);
  const gestorPodeAgir = ctx.canSubmitEvidence && !ctx.canWrite;
  const podeEditarTarefa = ctx.canWrite && (ctx.administrador || !m.responsavelUserId || m.responsavelUserId === ctx.usuarioId);

  return (
    <li className={`pj-tarefa${aberta ? " is-open" : ""}`} style={{ ["--c" as string]: st.cor }}>
      <div className="pj-tarefa__cabecalho">
        <button type="button" className="pj-tarefa__linha" aria-expanded={aberta} onClick={alternar}>
          <span className="pj-tarefa__check" aria-hidden="true">{encerrada ? "✓" : ""}</span>
          <span className="pj-tarefa__texto">
            <strong>{m.codigo ? `${m.codigo} · ` : ""}{m.descricao}</strong>
            <span className="pj-tarefa__meta">
              <span>👤 {m.responsavel || "Sem responsável"}</span>
              {prazo && <span>📅 {prazo}</span>}
              {!!m.subtarefas.length && <span>☑ {subsFeitas}/{m.subtarefas.length} subtarefas</span>}
              {!!evid.length && <span>📎 {evid.length} evidência{evid.length > 1 ? "s" : ""}</span>}
            </span>
          </span>
          {aguardando && <span className="pj-pill pj-pill--lav">Aguardando validação</span>}
          <span className="pj-pill">{st.label}</span>
          <span className="pj-chevron" aria-hidden="true">›</span>
        </button>
        {ctx.canWrite && !encerrada && (
          <button
            type="button"
            className="pj-tarefa__adicionar-subtarefa"
            aria-label={`Adicionar subtarefa à tarefa ${m.descricao}`}
            aria-expanded={aberta && criandoSubtarefa}
            onClick={() => { if (!aberta) alternar(); setCriandoSubtarefa(true); }}
          >+ Subtarefa</button>
        )}
      </div>

      {aberta && (
        <div className="pj-tarefa__det">
          <div className="pj-tarefa__colunas">
            <section>
              <h4>Subtarefas · {subsFeitas}/{m.subtarefas.length} concluídas</h4>
              {!m.subtarefas.length && (
                <p className="pj-vazio-mini">
                  {ctx.canWrite
                    ? "Nenhuma subtarefa ainda. Use + Subtarefa nesta tarefa para incluir o próximo passo."
                    : "Nenhuma subtarefa — a tarefa é entregue de uma vez."}
                </p>
              )}
              <ul className="pj-subs">
                {m.subtarefas.map((s) => (
                  <li key={s.id} className={s.concluida ? "is-done" : ""}>
                    {ctx.canWrite && (ctx.administrador || !s.responsavelUserId || s.responsavelUserId === ctx.usuarioId) ? (
                      <SubtarefaToggle token={ctx.token} subtarefaId={s.id} concluida={s.concluida} canWrite />
                    ) : (
                      <span className="pj-subs__dot" aria-label={s.concluida ? "Feita" : "Pendente"}>{s.concluida ? "✓" : ""}</span>
                    )}
                    <span className="pj-subs__nome">{s.descricao}</span>
                    {s.prazo && <small>Prazo: {fmt(s.prazo)}</small>}
                    {ctx.canWrite && (ctx.administrador || !s.responsavelUserId || s.responsavelUserId === ctx.usuarioId) ? (
                      <EditarResponsavel
                        token={ctx.token}
                        endpoint={`/iniciativas/subtarefas/${s.id}`}
                        atualId={s.responsavelUserId}
                        pessoas={ctx.responsaveis}
                        rotulo="Responsável pela subtarefa"
                      />
                    ) : (
                      s.responsavel && <small>{s.responsavel}</small>
                    )}
                  </li>
                ))}
              </ul>
              {ctx.canWrite && !encerrada && criandoSubtarefa && (
                <div className="pj-nova-subtarefa">
                  <CadastroTarefaProjeto token={ctx.token} iniciativaId={ctx.iniciativaId} marcoId={m.id} tarefaDescricao={m.descricao} responsaveis={ctx.responsaveis} onFechar={() => setCriandoSubtarefa(false)} />
                </div>
              )}
            </section>

            <section>
              <h4>Evidências desta tarefa</h4>
              {!evid.length && (
                <p className="pj-vazio-mini">
                  Nenhuma ainda. {gestorPodeAgir ? "Envie foto, vídeo ou documento do que já foi feito." : "O secretário envia foto, vídeo ou documento."}
                </p>
              )}
              <ul className="pj-evid">
                {evid.slice(0, 4).map((e) => {
                  const es = EVID_STATUS[e.status] ?? { label: e.status, cor: "#929bb4" };
                  return (
                    <li key={e.id} style={{ ["--c" as string]: es.cor }}>
                      <span aria-hidden="true">{EVID_ICONE[e.tipo || ""] ?? "📎"}</span>
                      <span className="pj-evid__nome">{e.titulo}</span>
                      <span className="pj-pill">{es.label}</span>
                    </li>
                  );
                })}
              </ul>
              {!!evid.length && (
                <button type="button" className="pj-link" onClick={() => ctx.onVerEvidencias(m.id)}>
                  Ver evidências desta tarefa →
                </button>
              )}
            </section>
          </div>

          {(m.reprogramacoes.length > 0 || prazo) && (
            <p className="pj-tarefa__prazo">
              {prazo ? <>Prazo atual <b>{prazo}</b></> : null}
              {m.reprogramacoes.length > 0 && <> · reprogramada {m.reprogramacoes.length}×</>}
            </p>
          )}

          {gestorPodeAgir && !encerrada && (
            <div className="pj-acoes">
              <button type="button" className={`ev-btn${painel === "EVIDENCIA" ? "" : " ev-btn--soft"}`} onClick={() => setPainel(painel === "EVIDENCIA" ? null : "EVIDENCIA")}>
                📎 Enviar evidência
              </button>
              {!aguardando && (
                <button type="button" className={`ev-btn${painel === "CONCLUSAO" ? "" : " ev-btn--soft"}`} onClick={() => setPainel(painel === "CONCLUSAO" ? null : "CONCLUSAO")}>
                  ✓ Informar que foi concluída
                </button>
              )}
            </div>
          )}
          {gestorPodeAgir && painel && (
            <EvidenciaEnvio
              key={painel}
              token={ctx.token}
              iniciativaId={ctx.iniciativaId}
              marcoId={m.id}
              marcoDescricao={m.descricao}
              modo={painel}
              onFechar={() => setPainel(null)}
            />
          )}

          {ctx.canWrite && (
            <div className="pj-acoes pj-acoes--consultor">
              <TarefaAcoes token={ctx.token} marcoId={m.id} concluidoEm={m.concluidoEm} canWrite={podeEditarTarefa} />
              <ItemTextoEditor token={ctx.token} endpoint={`/iniciativas/marcos/${m.id}`} value={m.descricao} canWrite={podeEditarTarefa} label="Renomear" />
              {podeEditarTarefa && <EditarResponsavel
                token={ctx.token}
                endpoint={`/iniciativas/marcos/${m.id}`}
                atualId={m.responsavelUserId}
                pessoas={ctx.responsaveis}
                rotulo="Responsável pela tarefa"
              />}
              <ReprogramarTarefa
                canWrite={!encerrada && podeEditarTarefa}
                token={ctx.token}
                marcoId={m.id}
                prazo={m.prazoVigente}
                historico={m.reprogramacoes}
              />
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export function ProjetoPastas({
  marcos,
  evidencias,
  aguardando,
  canWrite,
  canSubmitEvidence,
  token,
  responsaveis = [],
  usuarioId = "",
  administrador = false,
  iniciativaId,
  onVerEvidencias,
  filtroSelecionado,
  onSelecionarFiltro,
  buscaExterna,
  onBuscaChange,
  scrollRequest = 0,
}: {
  marcos: ProjetoDocMarco[];
  evidencias: EvidenciaItem[];
  aguardando: string[];
  canWrite: boolean;
  canSubmitEvidence: boolean;
  token: string;
  responsaveis?: ResponsavelOpcao[];
  usuarioId?: string;
  administrador?: boolean;
  iniciativaId: string;
  secretariaId: string;
  metaEstrategica?: ProjetoDocData["metaEstrategica"];
  permiteMetaPlano: boolean;
  onVerEvidencias: (marcoId: string) => void;
  filtroSelecionado?: Filtro;
  onSelecionarFiltro?: (filtro: Filtro) => void;
  buscaExterna?: string;
  onBuscaChange?: (busca: string) => void;
  scrollRequest?: number;
}) {
  const todas = marcos;
  const aguardandoSet = useMemo(() => new Set(aguardando), [aguardando]);
  const evidPorMarco = useMemo(() => {
    const map = new Map<string, EvidenciaItem[]>();
    for (const e of evidencias) {
      if (!e.marcoId) continue;
      map.set(e.marcoId, [...(map.get(e.marcoId) ?? []), e]);
    }
    return map;
  }, [evidencias]);

  const [filtroLocal, setFiltroLocal] = useState<Filtro>("TODAS");
  const [buscaLocal, setBuscaLocal] = useState("");
  const [criandoTarefa, setCriandoTarefa] = useState(false);
  const filtro = filtroSelecionado ?? filtroLocal;
  const busca = buscaExterna ?? buscaLocal;
  const [tarefaAberta, setTarefaAberta] = useState<string | null>(null);

  useEffect(() => {
    if (scrollRequest > 0) document.getElementById("pj-lista-tarefas")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [scrollRequest]);

  const ctx: Ctx = {
    canWrite,
    canSubmitEvidence,
    token,
    responsaveis,
    usuarioId,
    administrador,
    iniciativaId,
    aguardando: aguardandoSet,
    evidPorMarco,
    onVerEvidencias,
  };

  function passa(m: ProjetoDocMarco) {
    if (busca.trim()) {
      const q = busca.trim().toLowerCase();
      const alvo = [m.descricao, m.codigo, m.responsavel, ...m.subtarefas.map((s) => s.descricao)].join(" ").toLowerCase();
      if (!alvo.includes(q)) return false;
    }
    if (filtro === "TODAS") return true;
    if (filtro === "VALIDACAO") return aguardandoSet.has(m.id);
    return m.prazoStatus === filtro;
  }
  const contagem = (f: Filtro) =>
    f === "TODAS" ? todas.length : f === "VALIDACAO" ? todas.filter((m) => aguardandoSet.has(m.id)).length : todas.filter((m) => m.prazoStatus === f).length;
  const filtrando = filtro !== "TODAS" || !!busca.trim();

  return (
    <div className="pj-pastas" id="pj-lista-tarefas">
      <div className="pj-toolbar">
        <div className="pj-filtros" role="group" aria-label="Filtrar tarefas">
          {FILTROS.map((f) => {
            const n = contagem(f.id);
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={filtro === f.id}
                className="pj-filtro"
                style={f.cor ? { ["--c" as string]: f.cor } : undefined}
                onClick={() => { setFiltroLocal(f.id); onSelecionarFiltro?.(f.id); }}
              >
                {f.cor && <i aria-hidden="true" />}
                {f.label} <b>{n}</b>
              </button>
            );
          })}
        </div>
        <div className="pj-toolbar__dir">
          {canWrite && <button type="button" className="ev-btn" aria-expanded={criandoTarefa} onClick={() => setCriandoTarefa((valor) => !valor)}>+ Nova tarefa</button>}
          <input
            type="search"
            className="pj-busca"
            placeholder="Buscar tarefa ou pessoa…"
            aria-label="Buscar tarefa"
            value={busca}
            onChange={(e) => { setBuscaLocal(e.target.value); onBuscaChange?.(e.target.value); }}
          />
        </div>
      </div>
      {criandoTarefa && <CadastroTarefaProjeto token={token} iniciativaId={iniciativaId} responsaveis={responsaveis} onFechar={() => setCriandoTarefa(false)} />}

      {!todas.length && (
        <div className="pj-vazio">
          <span aria-hidden="true">🗂️</span>
          <strong>Este projeto ainda não tem tarefas</strong>
          <p>
            {canWrite
              ? "Use Nova tarefa para cadastrar a primeira entrega deste projeto."
              : "A consultoria vai organizar as tarefas deste projeto. Você será avisado quando houver algo atribuído a você."}
          </p>
        </div>
      )}

      <div className="pj-arvore">
        <ul className="pj-tarefas">
          {todas.filter(passa).map((m) => (
            <TarefaLinha
              key={m.id}
              m={m}
              ctx={ctx}
              aberta={tarefaAberta === m.id}
              alternar={() => setTarefaAberta((t) => (t === m.id ? null : m.id))}
            />
          ))}
        </ul>
        {filtrando && !todas.some(passa) && (
          <p className="pj-vazio-mini">Nenhuma tarefa encontrada com esse filtro.</p>
        )}
      </div>

    </div>
  );
}
