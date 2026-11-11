"use client";

import { Badge, Card } from "@cip/ui";
import { tonePrazo } from "@cip/shared";
import { DesdobramentoForms } from "./desdobramento-forms";
import { SugerirTarefas } from "./sugerir-tarefas";
import { ItemTextoEditor } from "./item-texto-editor";
import { ReprogramarTarefa } from "./reprogramar-tarefa";
import { ResponsavelEditor } from "./responsavel-editor";
import { SubtarefaToggle, TarefaAcoes } from "./tarefa-acoes";
import type { ProjetoDocMarco, ProjetoDocMeta } from "./projeto-documento";

const COLUNAS: Array<{ id: string; label: string; match: (st: string) => boolean }> = [
  { id: "SEM_PRAZO", label: "Sem prazo", match: (st) => st === "SEM_PRAZO" },
  { id: "NO_PRAZO", label: "No prazo", match: (st) => st === "NO_PRAZO" },
  { id: "VENCIDO", label: "Atrasadas", match: (st) => st === "VENCIDO" },
  { id: "CONCLUIDO", label: "Concluídas", match: (st) => st === "CONCLUIDO" },
];

function fmt(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

function subtarefaPct(m: ProjetoDocMarco) {
  if (!m.subtarefas.length) return m.concluidoEm ? 100 : 0;
  const done = m.subtarefas.filter((s) => s.concluida).length;
  return Math.round((done / m.subtarefas.length) * 100);
}

function TarefaCard({
  m,
  canWrite,
  token,
  equipe,
}: {
  m: ProjetoDocMarco;
  canWrite: boolean;
  token: string;
  equipe: string[];
}) {
  const pct = subtarefaPct(m);
  return (
    <article className="tb-card">
      <div className="tb-card__head">
        <strong>{m.codigo ? `${m.codigo} · ` : ""}{m.descricao}</strong>
        <Badge tone={tonePrazo(m.prazoStatus)}>{m.prazoStatus.replace("_", " ")}</Badge>
      </div>
      {m.gravidade && (
        <span className="tb-card__meta">Gravidade: {m.gravidade}</span>
      )}
      <div className="tb-progress" aria-hidden="true">
        <div className="tb-progress__bar" style={{ width: `${pct}%` }} />
      </div>
      <span className="tb-card__meta">
        {pct}% subtarefas · {m.responsavel || "sem responsável"} · prazo {fmt(m.prazoVigente)}
      </span>
      <div className="chip-row" style={{ alignItems: "center" }}>
        <ItemTextoEditor
          token={token}
          endpoint={`/iniciativas/marcos/${m.id}`}
          value={m.descricao}
          canWrite={canWrite}
          label="Editar"
        />
        <TarefaAcoes
          token={token}
          marcoId={m.id}
          concluidoEm={m.concluidoEm}
          canWrite={canWrite}
        />
        <ResponsavelEditor
          token={token}
          endpoint={`/iniciativas/marcos/${m.id}`}
          value={m.responsavel}
          equipe={equipe}
          listId="equipe-projeto"
          canWrite={canWrite}
        />
      </div>
      <ReprogramarTarefa
        canWrite={canWrite && !m.concluidoEm && m.prazoStatus !== "CONCLUIDO"}
        token={token}
        marcoId={m.id}
        prazo={m.prazoVigente}
        historico={m.reprogramacoes}
      />
      <ul className="tb-subs">
        {m.subtarefas.map((st) => (
          <li key={st.id}>
            <SubtarefaToggle
              token={token}
              subtarefaId={st.id}
              concluida={st.concluida}
              canWrite={canWrite}
            />
            <span>{st.descricao}</span>
            <ResponsavelEditor
              token={token}
              endpoint={`/iniciativas/subtarefas/${st.id}`}
              value={st.responsavel}
              equipe={equipe}
              listId="equipe-projeto"
              canWrite={canWrite}
            />
          </li>
        ))}
      </ul>
      {canWrite && (
        <DesdobramentoForms equipe={equipe} mode="subtarefa" token={token} marcoId={m.id} />
      )}
    </article>
  );
}

export function TarefasBoard({
  metasExecucao,
  marcosSemMeta,
  canWrite,
  token,
  equipe,
  iniciativaId,
}: {
  metasExecucao: ProjetoDocMeta[];
  marcosSemMeta: ProjetoDocMarco[];
  canWrite: boolean;
  token: string;
  equipe: string[];
  iniciativaId: string;
}) {
  const todas = [
    ...metasExecucao.flatMap((me) => me.marcos),
    ...marcosSemMeta,
  ];

  return (
    <div className="stack">
      <div className="tb-board" role="list">
        {COLUNAS.map((col) => {
          const items = todas.filter((m) => col.match(m.prazoStatus));
          return (
            <section key={col.id} className="tb-col" role="listitem" aria-label={col.label}>
              <header className="tb-col__head">
                <strong>{col.label}</strong>
                <span>{items.length}</span>
              </header>
              <div className="tb-col__body">
                {items.map((m) => (
                  <TarefaCard
                    key={m.id}
                    m={m}
                    canWrite={canWrite}
                    token={token}
                    equipe={equipe}
                  />
                ))}
                {!items.length && (
                  <p className="dashboard-muted tb-col__empty">Nenhuma tarefa</p>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {!metasExecucao.length && (
        <Card title="Comece pela meta de execução">
          <p className="dashboard-muted">
            Sem meta de execução o escopo fica incompleto.
          </p>
          {canWrite && (
            <DesdobramentoForms
              equipe={equipe}
              mode="meta"
              token={token}
              iniciativaId={iniciativaId}
            />
          )}
        </Card>
      )}

      {metasExecucao.map((me) => {
        const done = me.marcos.filter((m) => m.prazoStatus === "CONCLUIDO").length;
        const total = me.marcos.length;
        const pct = total ? Math.round((done / total) * 100) : 0;
        return (
          <details key={me.id} className="more-block projeto-pasta" open>
            <summary>
              {me.codigo ? `${me.codigo} · ` : ""}
              {me.nome} · {pct}% · Resp.: {me.responsavel || "sem responsável"}
            </summary>
            <div className="stack" style={{ marginTop: 12 }}>
              <div className="dashboard-muted">
                Indicador: {me.indicador || "—"} · Alvo: {me.alvo || "—"} · Atual:{" "}
                {me.valorAtual || "—"} · Prazo: {fmt(me.prazo)}
              </div>
              <div className="projeto-progress">
                <div className="projeto-progress__bar" style={{ width: `${pct}%` }} />
              </div>
              <ResponsavelEditor
                token={token}
                endpoint={`/iniciativas/metas-execucao/${me.id}`}
                value={me.responsavel}
                equipe={equipe}
                listId="equipe-projeto"
                canWrite={canWrite}
              />
              {me.marcos.map((m) => (
                <TarefaCard
                  key={m.id}
                  m={m}
                  canWrite={canWrite}
                  token={token}
                  equipe={equipe}
                />
              ))}
              {canWrite && (
                <>
                  <DesdobramentoForms
                    equipe={equipe}
                    mode="tarefa"
                    token={token}
                    iniciativaId={iniciativaId}
                    metaExecucaoId={me.id}
                  />
                  <SugerirTarefas token={token} metaExecucaoId={me.id} />
                </>
              )}
            </div>
          </details>
        );
      })}

      {!!marcosSemMeta.length && (
        <Card title="Tarefas sem meta de execução">
          {marcosSemMeta.map((m) => (
            <TarefaCard
              key={m.id}
              m={m}
              canWrite={canWrite}
              token={token}
              equipe={equipe}
            />
          ))}
        </Card>
      )}

      {canWrite && (
        <div className="chip-row">
          <DesdobramentoForms
            equipe={equipe}
            mode="tarefa"
            token={token}
            iniciativaId={iniciativaId}
          />
          {!!metasExecucao.length && (
            <DesdobramentoForms
              equipe={equipe}
              mode="meta"
              token={token}
              iniciativaId={iniciativaId}
            />
          )}
        </div>
      )}
    </div>
  );
}
