"use client";

import { useMemo, useState } from "react";
import { DesdobramentoForms } from "./desdobramento-forms";
import { EvidenciaEnvio } from "./evidencia-envio";
import { ItemTextoEditor } from "./item-texto-editor";
import { ReprogramarTarefa } from "./reprogramar-tarefa";
import { ResponsavelEditor } from "./responsavel-editor";
import { SugerirTarefas } from "./sugerir-tarefas";
import { SubtarefaToggle, TarefaAcoes } from "./tarefa-acoes";
import type { EvidenciaItem } from "./evidencia-actions";
import type { ProjetoDocMarco, ProjetoDocMeta } from "./projeto-documento";

export const STATUS_TAREFA: Record<string, { label: string; cor: string }> = {
  VENCIDO: { label: "Atrasada", cor: "#ff5982" },
  SEM_PRAZO: { label: "Sem prazo", cor: "#eac78c" },
  NO_PRAZO: { label: "No prazo", cor: "#7c9cff" },
  CONCLUIDO: { label: "Concluída", cor: "#b4e4a0" },
  ENCERRADO_SEM_SOLUCAO: { label: "Encerrada", cor: "#929bb4" },
};

type Filtro = "TODAS" | "VENCIDO" | "SEM_PRAZO" | "NO_PRAZO" | "CONCLUIDO" | "VALIDACAO";

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

/** Cor da pasta: a pior situação entre as tarefas abertas. */
function corDaPasta(marcos: ProjetoDocMarco[]) {
  if (!marcos.length) return "#929bb4";
  if (marcos.some((m) => m.prazoStatus === "VENCIDO")) return STATUS_TAREFA.VENCIDO.cor;
  if (marcos.every((m) => m.prazoStatus === "CONCLUIDO")) return STATUS_TAREFA.CONCLUIDO.cor;
  if (marcos.some((m) => m.prazoStatus === "SEM_PRAZO")) return STATUS_TAREFA.SEM_PRAZO.cor;
  return STATUS_TAREFA.NO_PRAZO.cor;
}

type Ctx = {
  canWrite: boolean;
  canSubmitEvidence: boolean;
  token: string;
  equipe: string[];
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
  const st = statusDe(m);
  const subsFeitas = m.subtarefas.filter((s) => s.concluida).length;
  const evid = ctx.evidPorMarco.get(m.id) ?? [];
  const aguardando = ctx.aguardando.has(m.id);
  const encerrada = m.prazoStatus === "CONCLUIDO" || m.prazoStatus === "ENCERRADO_SEM_SOLUCAO";
  const prazo = fmt(m.prazoVigente ?? m.prazoOriginal);
  const gestorPodeAgir = ctx.canSubmitEvidence && !ctx.canWrite;

  return (
    <li className={`pj-tarefa${aberta ? " is-open" : ""}`} style={{ ["--c" as string]: st.cor }}>
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

      {aberta && (
        <div className="pj-tarefa__det">
          <div className="pj-tarefa__colunas">
            <section>
              <h4>Subtarefas</h4>
              {!m.subtarefas.length && <p className="pj-vazio-mini">Nenhuma subtarefa — a tarefa é entregue de uma vez.</p>}
              <ul className="pj-subs">
                {m.subtarefas.map((s) => (
                  <li key={s.id} className={s.concluida ? "is-done" : ""}>
                    {ctx.canWrite ? (
                      <SubtarefaToggle token={ctx.token} subtarefaId={s.id} concluida={s.concluida} canWrite />
                    ) : (
                      <span className="pj-subs__dot" aria-label={s.concluida ? "Feita" : "Pendente"}>{s.concluida ? "✓" : ""}</span>
                    )}
                    <span className="pj-subs__nome">{s.descricao}</span>
                    {ctx.canWrite ? (
                      <ResponsavelEditor
                        token={ctx.token}
                        endpoint={`/iniciativas/subtarefas/${s.id}`}
                        value={s.responsavel}
                        equipe={ctx.equipe}
                        listId="equipe-projeto"
                        canWrite
                      />
                    ) : (
                      s.responsavel && <small>{s.responsavel}</small>
                    )}
                  </li>
                ))}
              </ul>
              {ctx.canWrite && (
                <DesdobramentoForms equipe={ctx.equipe} mode="subtarefa" token={ctx.token} marcoId={m.id} />
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
              <TarefaAcoes token={ctx.token} marcoId={m.id} concluidoEm={m.concluidoEm} canWrite />
              <ItemTextoEditor token={ctx.token} endpoint={`/iniciativas/marcos/${m.id}`} value={m.descricao} canWrite label="Renomear" />
              <ResponsavelEditor
                token={ctx.token}
                endpoint={`/iniciativas/marcos/${m.id}`}
                value={m.responsavel}
                equipe={ctx.equipe}
                listId="equipe-projeto"
                canWrite
              />
              <ReprogramarTarefa
                canWrite={!encerrada}
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

type Pasta = {
  id: string;
  titulo: string;
  codigo?: string | null;
  meta?: ProjetoDocMeta;
  marcos: ProjetoDocMarco[];
};

/**
 * Tarefas do projeto em formato de pastas: cada meta de execução é uma pasta,
 * dentro dela as tarefas e, ao abrir a tarefa, as subtarefas e evidências.
 */
export function ProjetoPastas({
  metasExecucao,
  marcosSemMeta,
  evidencias,
  aguardando,
  canWrite,
  canSubmitEvidence,
  token,
  equipe,
  iniciativaId,
  onVerEvidencias,
}: {
  metasExecucao: ProjetoDocMeta[];
  marcosSemMeta: ProjetoDocMarco[];
  evidencias: EvidenciaItem[];
  aguardando: string[];
  canWrite: boolean;
  canSubmitEvidence: boolean;
  token: string;
  equipe: string[];
  iniciativaId: string;
  onVerEvidencias: (marcoId: string) => void;
}) {
  const pastas: Pasta[] = useMemo(
    () => [
      ...metasExecucao.map((me) => ({ id: me.id, titulo: me.nome, codigo: me.codigo, meta: me, marcos: me.marcos })),
      ...(marcosSemMeta.length
        ? [{ id: "__sem_meta", titulo: "Tarefas avulsas (sem meta de execução)", marcos: marcosSemMeta }]
        : []),
    ],
    [metasExecucao, marcosSemMeta],
  );
  const todas = pastas.flatMap((p) => p.marcos);
  const aguardandoSet = useMemo(() => new Set(aguardando), [aguardando]);
  const evidPorMarco = useMemo(() => {
    const map = new Map<string, EvidenciaItem[]>();
    for (const e of evidencias) {
      if (!e.marcoId) continue;
      map.set(e.marcoId, [...(map.get(e.marcoId) ?? []), e]);
    }
    return map;
  }, [evidencias]);

  const [filtro, setFiltro] = useState<Filtro>("TODAS");
  const [busca, setBusca] = useState("");
  const [abertas, setAbertas] = useState<Set<string>>(
    () =>
      new Set(
        pastas.length <= 3
          ? pastas.map((p) => p.id)
          : pastas.filter((p) => p.marcos.some((m) => m.prazoStatus === "VENCIDO")).map((p) => p.id),
      ),
  );
  const [tarefaAberta, setTarefaAberta] = useState<string | null>(null);

  const ctx: Ctx = {
    canWrite,
    canSubmitEvidence,
    token,
    equipe,
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

  function alternarPasta(id: string) {
    setAbertas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="pj-pastas">
      <div className="pj-toolbar">
        <div className="pj-filtros" role="group" aria-label="Filtrar tarefas">
          {FILTROS.map((f) => {
            const n = contagem(f.id);
            if (f.id !== "TODAS" && !n) return null;
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={filtro === f.id}
                className="pj-filtro"
                style={f.cor ? { ["--c" as string]: f.cor } : undefined}
                onClick={() => setFiltro(f.id)}
              >
                {f.cor && <i aria-hidden="true" />}
                {f.label} <b>{n}</b>
              </button>
            );
          })}
        </div>
        <div className="pj-toolbar__dir">
          <input
            type="search"
            className="pj-busca"
            placeholder="Buscar tarefa ou pessoa…"
            aria-label="Buscar tarefa"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <button
            type="button"
            className="pj-link"
            onClick={() =>
              setAbertas((prev) => (prev.size === pastas.length ? new Set() : new Set(pastas.map((p) => p.id))))
            }
          >
            {abertas.size === pastas.length ? "Recolher pastas" : "Abrir todas"}
          </button>
        </div>
      </div>

      {!pastas.length && (
        <div className="pj-vazio">
          <span aria-hidden="true">🗂️</span>
          <strong>Este projeto ainda não tem metas nem tarefas</strong>
          <p>
            {canWrite
              ? "Comece criando a primeira meta de execução — ela vira uma pasta com as tarefas dentro."
              : "A consultoria vai organizar as metas e tarefas deste projeto. Você será avisado quando houver algo atribuído a você."}
          </p>
          {canWrite && <DesdobramentoForms equipe={equipe} mode="meta" token={token} iniciativaId={iniciativaId} />}
        </div>
      )}

      <div className="pj-arvore">
        {pastas.map((p) => {
          const visiveis = p.marcos.filter(passa);
          if (filtrando && !visiveis.length) return null;
          const aberta = filtrando || abertas.has(p.id);
          const feitas = p.marcos.filter((m) => m.prazoStatus === "CONCLUIDO").length;
          const atrasadas = p.marcos.filter((m) => m.prazoStatus === "VENCIDO").length;
          const pct = p.marcos.length ? Math.round((feitas / p.marcos.length) * 100) : 0;
          const cor = corDaPasta(p.marcos);
          const me = p.meta;
          return (
            <section key={p.id} className={`pj-pasta${aberta ? " is-open" : ""}`} style={{ ["--c" as string]: cor }}>
              <button type="button" className="pj-pasta__cab" aria-expanded={aberta} onClick={() => alternarPasta(p.id)}>
                <span className="pj-pasta__icone" aria-hidden="true">{aberta ? "📂" : "📁"}</span>
                <span className="pj-pasta__titulo">
                  <small>{me ? `Meta de execução${p.codigo ? ` · ${p.codigo}` : ""}` : "Sem pasta"}</small>
                  <strong>{p.titulo}</strong>
                  <span className="pj-pasta__info">
                    {me?.responsavel && <span>👤 {me.responsavel}</span>}
                    {me?.prazo && <span>📅 até {fmt(me.prazo)}</span>}
                    {me?.indicador && (
                      <span>
                        📈 {me.indicador}
                        {(me.valorAtual || me.alvo) && ` · ${me.valorAtual || "—"} de ${me.alvo || "—"}`}
                      </span>
                    )}
                  </span>
                </span>
                <span className="pj-pasta__nums">
                  {atrasadas > 0 && <span className="pj-pill pj-pill--rose">{atrasadas} atrasada{atrasadas > 1 ? "s" : ""}</span>}
                  <span className="pj-pasta__count">{feitas}/{p.marcos.length} tarefas</span>
                </span>
                <span className="pj-pasta__pct" aria-label={`${pct}% concluído`}>
                  <b>{pct}%</b>
                  <i><em style={{ width: `${pct}%` }} /></i>
                </span>
                <span className="pj-chevron" aria-hidden="true">›</span>
              </button>

              {aberta && (
                <div className="pj-pasta__corpo">
                  {!p.marcos.length && <p className="pj-vazio-mini">Pasta vazia — nenhuma tarefa cadastrada.</p>}
                  <ul className="pj-tarefas">
                    {visiveis.map((m) => (
                      <TarefaLinha
                        key={m.id}
                        m={m}
                        ctx={ctx}
                        aberta={tarefaAberta === m.id}
                        alternar={() => setTarefaAberta((t) => (t === m.id ? null : m.id))}
                      />
                    ))}
                  </ul>
                  {canWrite && (
                    <div className="pj-pasta__rodape">
                      {me && (
                        <ResponsavelEditor
                          token={token}
                          endpoint={`/iniciativas/metas-execucao/${me.id}`}
                          value={me.responsavel}
                          equipe={equipe}
                          listId="equipe-projeto"
                          canWrite
                        />
                      )}
                      <DesdobramentoForms
                        equipe={equipe}
                        mode="tarefa"
                        token={token}
                        iniciativaId={iniciativaId}
                        metaExecucaoId={me?.id}
                      />
                      {me && <SugerirTarefas token={token} metaExecucaoId={me.id} />}
                    </div>
                  )}
                </div>
              )}
            </section>
          );
        })}
        {filtrando && !todas.some(passa) && (
          <p className="pj-vazio-mini">Nenhuma tarefa encontrada com esse filtro.</p>
        )}
      </div>

      {canWrite && !!pastas.length && (
        <div className="pj-nova-pasta">
          <DesdobramentoForms equipe={equipe} mode="meta" token={token} iniciativaId={iniciativaId} />
        </div>
      )}
    </div>
  );
}
