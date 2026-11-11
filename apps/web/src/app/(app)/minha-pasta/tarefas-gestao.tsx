"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@cip/ui";

export type TarefaGestaoItem = {
  id: string;
  codigo: string | null;
  descricao: string;
  status: string;
  responsavel: string | null;
  prazo: string | null;
  meta: string | null;
  subtarefas: { total: number; concluidas: number };
  iniciativaId: string;
  iniciativaCodigo: string;
  iniciativaNome: string;
  secretaria: string;
};

type Filtro = "TODAS" | "ABERTAS" | "ATRASADAS" | "SEM_PRAZO" | "CONCLUIDAS";
type Visualizacao = "LISTA" | "QUADRO";

const filtros: Array<{ id: Filtro; label: string }> = [
  { id: "TODAS", label: "Todas" },
  { id: "ABERTAS", label: "Em aberto" },
  { id: "ATRASADAS", label: "Atrasadas" },
  { id: "SEM_PRAZO", label: "Sem prazo" },
  { id: "CONCLUIDAS", label: "Concluídas" },
];

const colunas = [
  { id: "VENCIDO", titulo: "Atrasadas", tone: "danger" },
  { id: "SEM_PRAZO", titulo: "Sem prazo", tone: "warning" },
  { id: "NO_PRAZO", titulo: "No prazo", tone: "info" },
  { id: "CONCLUIDO", titulo: "Concluídas", tone: "success" },
  { id: "ENCERRADO_SEM_SOLUCAO", titulo: "Encerradas", tone: "neutral" },
] as const;

const statusLabel: Record<string, string> = {
  VENCIDO: "Atrasada",
  SEM_PRAZO: "Sem prazo",
  NO_PRAZO: "No prazo",
  CONCLUIDO: "Concluída",
  ENCERRADO_SEM_SOLUCAO: "Encerrada sem solução",
};

function dataCurta(value: string | null) {
  if (!value) return "Sem prazo";
  return new Date(value).toLocaleDateString("pt-BR");
}

function tarefasParaFiltro(tarefa: TarefaGestaoItem, filtro: Filtro) {
  if (filtro === "TODAS") return true;
  if (filtro === "ABERTAS") {
    return !["CONCLUIDO", "ENCERRADO_SEM_SOLUCAO"].includes(tarefa.status);
  }
  if (filtro === "ATRASADAS") return tarefa.status === "VENCIDO";
  if (filtro === "SEM_PRAZO") return tarefa.status === "SEM_PRAZO";
  return tarefa.status === "CONCLUIDO";
}

function TarefaCard({ tarefa }: { tarefa: TarefaGestaoItem }) {
  const tone =
    tarefa.status === "VENCIDO"
      ? "danger"
      : tarefa.status === "CONCLUIDO"
        ? "success"
        : tarefa.status === "NO_PRAZO"
          ? "info"
          : "warning";
  const evidenciaHref = `/iniciativas/${tarefa.iniciativaId}?aba=evidencias&marcoId=${encodeURIComponent(tarefa.id)}`;

  return (
    <article className="gestao-tarefa">
      <div className="gestao-tarefa__main">
        <div className="gestao-tarefa__title-row">
          <strong>{tarefa.codigo ? `${tarefa.codigo} · ` : ""}{tarefa.descricao}</strong>
          <Badge tone={tone}>{statusLabel[tarefa.status] || tarefa.status}</Badge>
        </div>
        <Link
          href={`/iniciativas/${tarefa.iniciativaId}?aba=andamento`}
          className="gestao-tarefa__project"
        >
          {tarefa.iniciativaCodigo} · {tarefa.iniciativaNome}
        </Link>
        <div className="gestao-tarefa__meta">
          <span>{tarefa.meta || "Sem meta vinculada"}</span>
          <span>
            {tarefa.subtarefas.concluidas}/{tarefa.subtarefas.total} subtarefas
          </span>
        </div>
      </div>
      <div className="gestao-tarefa__details">
        <span className="gestao-tarefa__detail-label">Responsável</span>
        <strong>{tarefa.responsavel || "A definir"}</strong>
      </div>
      <div className="gestao-tarefa__details">
        <span className="gestao-tarefa__detail-label">Prazo</span>
        <strong>{dataCurta(tarefa.prazo)}</strong>
      </div>
      {tarefa.status !== "CONCLUIDO" &&
        tarefa.status !== "ENCERRADO_SEM_SOLUCAO" && (
          <Link className="gestao-tarefa__action" href={evidenciaHref}>
            Registrar avanço
          </Link>
        )}
    </article>
  );
}

export function TarefasGestao({
  tarefas,
}: {
  tarefas: TarefaGestaoItem[];
}) {
  const [filtro, setFiltro] = useState<Filtro>("ABERTAS");
  const [visualizacao, setVisualizacao] = useState<Visualizacao>("LISTA");
  const [busca, setBusca] = useState("");

  const normalizedSearch = busca.trim().toLocaleLowerCase("pt-BR");
  const filtradas = tarefas.filter((tarefa) => {
    if (!tarefasParaFiltro(tarefa, filtro)) return false;
    if (!normalizedSearch) return true;
    return [
      tarefa.codigo,
      tarefa.descricao,
      tarefa.iniciativaCodigo,
      tarefa.iniciativaNome,
      tarefa.meta,
      tarefa.responsavel,
    ]
      .filter(Boolean)
      .some((value) => value!.toLocaleLowerCase("pt-BR").includes(normalizedSearch));
  });

  const abertas = tarefas.filter((tarefa) =>
    tarefasParaFiltro(tarefa, "ABERTAS"),
  ).length;
  const atrasadas = tarefas.filter((tarefa) => tarefa.status === "VENCIDO").length;
  const semPrazo = tarefas.filter((tarefa) => tarefa.status === "SEM_PRAZO").length;
  const concluidas = tarefas.filter((tarefa) => tarefa.status === "CONCLUIDO").length;

  return (
    <section
      className="pasta-section gestao-tarefas"
      aria-labelledby="gestao-tarefas-title"
    >
      <div className="pasta-section__head">
        <div>
          <h2 id="gestao-tarefas-title">Tarefas da secretaria</h2>
          <p>
            Priorize prazos, acompanhe responsáveis e registre o avanço direto
            na tarefa.
          </p>
        </div>
        <div className="gestao-tarefas__summary" aria-label="Resumo das tarefas">
          <span><strong>{abertas}</strong> em aberto</span>
          <span><strong>{atrasadas}</strong> atrasadas</span>
          <span><strong>{semPrazo}</strong> sem prazo</span>
          <span><strong>{concluidas}</strong> concluídas</span>
        </div>
      </div>

      <div className="gestao-tarefas__toolbar">
        <label className="gestao-tarefas__search">
          <span className="sr-only">Buscar tarefa</span>
          <input
            type="search"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar tarefa, projeto, meta ou responsável"
          />
        </label>
        <div className="gestao-tarefas__views" aria-label="Modo de visualização">
          <button
            type="button"
            aria-pressed={visualizacao === "LISTA"}
            onClick={() => setVisualizacao("LISTA")}
          >
            Lista
          </button>
          <button
            type="button"
            aria-pressed={visualizacao === "QUADRO"}
            onClick={() => setVisualizacao("QUADRO")}
          >
            Quadro
          </button>
        </div>
      </div>

      <div className="gestao-tarefas__filters" aria-label="Filtrar tarefas">
        {filtros.map((item) => {
          const count = tarefas.filter((tarefa) =>
            tarefasParaFiltro(tarefa, item.id),
          ).length;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={filtro === item.id}
              onClick={() => setFiltro(item.id)}
            >
              {item.label} <span>{count}</span>
            </button>
          );
        })}
      </div>

      {visualizacao === "LISTA" ? (
        <div className="gestao-tarefas__list">
          {filtradas.map((tarefa) => (
            <TarefaCard key={tarefa.id} tarefa={tarefa} />
          ))}
        </div>
      ) : (
        <div className="gestao-tarefas__board">
          {colunas.map((coluna) => {
            const itens = filtradas.filter(
              (tarefa) => tarefa.status === coluna.id,
            );
            return (
              <section key={coluna.id} className="gestao-tarefas__column">
                <h3>
                  <span data-tone={coluna.tone} />
                  {coluna.titulo}
                  <small>{itens.length}</small>
                </h3>
                <div className="gestao-tarefas__column-list">
                  {itens.map((tarefa) => (
                    <TarefaCard key={tarefa.id} tarefa={tarefa} />
                  ))}
                  {!itens.length && (
                    <p className="dashboard-muted">Nenhuma tarefa</p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {!filtradas.length && (
        <div className="pasta-empty">
          <p>
            {tarefas.length
              ? "Nenhuma tarefa corresponde a esta busca e filtro."
              : "Ainda não há tarefas vinculadas a esta secretaria."}
          </p>
        </div>
      )}
    </section>
  );
}
