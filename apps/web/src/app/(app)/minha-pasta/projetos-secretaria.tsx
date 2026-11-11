"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@cip/ui";

export type ProjetoSecretariaItem = {
  id: string;
  codigo: string;
  nome: string;
  ciclo: string;
  estruturante: boolean;
  bloqueioLabel?: string | null;
  participacao: "PRINCIPAL" | "CORRELACIONADO";
  pendencias: number;
  totalTarefas: number;
  concluidas: number;
  atrasadas: number;
  semPrazo: number;
  pctConclusao: number;
  atualizadoEm: string;
  secretariaPrincipalNome: string;
};

type FiltroProjeto = "TODOS" | "PRINCIPAIS" | "CORRELACIONADOS" | "ATENCAO";

const filtros: Array<{ id: FiltroProjeto; label: string }> = [
  { id: "TODOS", label: "Todos os projetos" },
  { id: "PRINCIPAIS", label: "Responsabilidade da secretaria" },
  { id: "CORRELACIONADOS", label: "Participação compartilhada" },
  { id: "ATENCAO", label: "Precisam de atenção" },
];

function projetoCorresponde(projeto: ProjetoSecretariaItem, filtro: FiltroProjeto) {
  if (filtro === "PRINCIPAIS") return projeto.participacao === "PRINCIPAL";
  if (filtro === "CORRELACIONADOS") {
    return projeto.participacao === "CORRELACIONADO";
  }
  if (filtro === "ATENCAO") {
    return Boolean(
      projeto.atrasadas || projeto.pendencias || projeto.semPrazo || projeto.bloqueioLabel,
    );
  }
  return true;
}

export function ProjetosSecretaria({
  projetos,
}: {
  projetos: ProjetoSecretariaItem[];
}) {
  const [filtro, setFiltro] = useState<FiltroProjeto>("TODOS");
  const [busca, setBusca] = useState("");
  const buscaNormalizada = busca.trim().toLocaleLowerCase("pt-BR");

  const filtrados = projetos.filter((projeto) => {
    if (!projetoCorresponde(projeto, filtro)) return false;
    if (!buscaNormalizada) return true;
    return [projeto.codigo, projeto.nome, projeto.secretariaPrincipalNome]
      .some((value) => value.toLocaleLowerCase("pt-BR").includes(buscaNormalizada));
  });
  const principais = projetos.filter(
    (projeto) => projeto.participacao === "PRINCIPAL",
  ).length;
  const correlacionados = projetos.length - principais;
  const comAtraso = projetos.filter((projeto) => projeto.atrasadas > 0).length;

  return (
    <section
      className="pasta-section projetos-secretaria"
      aria-labelledby="projetos-secretaria-title"
    >
      <div className="pasta-section__head projetos-secretaria__heading">
        <div>
          <h2 id="projetos-secretaria-title">Carteira da secretaria</h2>
          <p>
            Projetos sob responsabilidade direta e projetos em que a secretaria
            contribui com outras áreas.
          </p>
        </div>
        <div className="projetos-secretaria__summary">
          <span><strong>{projetos.length}</strong> projetos no total</span>
          <span><strong>{principais}</strong> principais</span>
          <span><strong>{correlacionados}</strong> compartilhados</span>
          <span><strong>{comAtraso}</strong> com atrasos</span>
        </div>
      </div>

      <div className="projetos-secretaria__toolbar">
        <label className="projetos-secretaria__search">
          <span className="sr-only">Buscar projeto ou secretaria responsável</span>
          <input
            type="search"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar projeto ou secretaria responsável"
          />
        </label>
        <div
          className="projetos-secretaria__filters"
          aria-label="Filtrar carteira de projetos"
        >
          {filtros.map((item) => {
            const count = projetos.filter((projeto) =>
              projetoCorresponde(projeto, item.id),
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
      </div>

      {filtrados.length ? (
        <div className="projetos-secretaria__grid">
          {filtrados.map((projeto) => (
            <article key={projeto.id} className="projeto-visao-card">
              <div className="projeto-visao-card__top">
                <Badge
                  tone={projeto.participacao === "PRINCIPAL" ? "info" : "neutral"}
                >
                  {projeto.participacao === "PRINCIPAL"
                    ? "Responsável"
                    : `Compartilhado · ${projeto.secretariaPrincipalNome}`}
                </Badge>
                {projeto.estruturante && <Badge tone="rose">Prioritário</Badge>}
              </div>

              <div className="projeto-visao-card__title">
                <span>{projeto.codigo}</span>
                <h3>{projeto.nome}</h3>
              </div>

              {(projeto.bloqueioLabel || projeto.pendencias > 0) && (
                <p className="projeto-visao-card__alert">
                  {projeto.bloqueioLabel ||
                    `${projeto.pendencias} impedimentos em acompanhamento`}
                </p>
              )}

              <div
                className="projeto-visao-card__progress"
                role="progressbar"
                aria-label={`Conclusão das tarefas do projeto ${projeto.nome}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={projeto.pctConclusao}
              >
                <div>
                  <span>Conclusão das tarefas</span>
                  <strong>{projeto.pctConclusao}%</strong>
                </div>
                <span className="projeto-visao-card__track">
                  <span style={{ width: `${projeto.pctConclusao}%` }} />
                </span>
                <small>
                  {projeto.concluidas} de {projeto.totalTarefas} concluídas
                </small>
              </div>

              <div className="projeto-visao-card__metrics">
                <span><strong>{projeto.atrasadas}</strong> atrasadas</span>
                <span><strong>{projeto.semPrazo}</strong> sem prazo</span>
                <span><strong>{projeto.pendencias}</strong> impedimentos</span>
              </div>

              <Link
                href={`/iniciativas/${projeto.id}?aba=andamento`}
                className="projeto-visao-card__link"
              >
                Abrir acompanhamento
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="pasta-empty">
          <p>
            {projetos.length
              ? "Nenhum projeto corresponde a este filtro."
              : "Ainda não há projetos principais ou compartilhados com esta secretaria."}
          </p>
        </div>
      )}
    </section>
  );
}
