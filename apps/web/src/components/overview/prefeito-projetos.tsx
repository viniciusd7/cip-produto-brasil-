"use client";

import Link from "next/link";
import { useState } from "react";
import type { OverviewResponse } from "./types";

type Projeto = NonNullable<OverviewResponse["data"]["projetosVisao"]>[number];

const CICLO: Record<string, string> = {
  EM_PLANEJAMENTO: "Em planejamento",
  EM_ACOMPANHAMENTO: "Em acompanhamento",
  AGUARDANDO_PRE_REQUISITO: "Aguardando providência",
  CONCLUIDA: "Concluído",
  SUSPENSA: "Suspenso",
};

function situacao(projeto: Projeto) {
  if (projeto.atrasadas) return { texto: "Com atraso", cor: "#ff5982" };
  if (!projeto.totalTarefas) return { texto: "Sem tarefas", cor: "#929bb4" };
  if (projeto.concluidas === projeto.totalTarefas) return { texto: "Entregas concluídas", cor: "#b4e4a0" };
  return { texto: "Em andamento", cor: "#7c9cff" };
}

export function PrefeitoProjetos({ projetos }: { projetos: Projeto[] }) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("");
  const [secretaria, setSecretaria] = useState("");
  const secretarias = [...new Set(projetos.map((projeto) => projeto.secretaria))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const visiveis = projetos.filter((projeto) => {
    const termo = busca.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const nome = `${projeto.codigo} ${projeto.nome} ${projeto.secretaria}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return nome.includes(termo) && (!secretaria || projeto.secretaria === secretaria) && (
      !filtro ||
      (filtro === "ATRASO" && projeto.atrasadas > 0) ||
      (filtro === "SEM_TAREFAS" && projeto.totalTarefas === 0) ||
      (filtro === "PENDENCIAS" && projeto.pendencias > 0) ||
      (filtro === "EM_DIA" && projeto.totalTarefas > 0 && projeto.atrasadas === 0)
    );
  });
  const comAtraso = projetos.filter((projeto) => projeto.atrasadas > 0).length;
  const comPendencias = projetos.filter((projeto) => projeto.pendencias > 0).length;

  return (
    <section className="prefeito-projects" aria-label="Projetos do governo">
      <div className="prefeito-projects__head">
        <div>
          <p className="gl-kicker">Carteira do município</p>
          <h2>Projetos do governo</h2>
          <p>Abra um projeto para acompanhar tarefas, entregas e providências.</p>
        </div>
        <Link href="/carteira" className="gl-link">Ver carteira completa →</Link>
      </div>
      <div className="gl-executivo-resumo" aria-label="Resumo dos projetos">
        <div><strong>{projetos.length}</strong><span>projetos cadastrados</span></div>
        <div><strong>{comAtraso}</strong><span>com entregas atrasadas</span></div>
        <div><strong>{comPendencias}</strong><span>com providências abertas</span></div>
      </div>
      <details className="filterPanel prefeito-projects__filters">
        <summary className="filterPanelHead"><strong>Filtros adicionais</strong><span>Busque por projeto, situação ou secretaria</span></summary>
        <div className="prefeito-projects__filter-grid">
          <div><label htmlFor="projeto-busca">Buscar projeto</label><input id="projeto-busca" type="search" value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Código ou nome" /></div>
          <div><label htmlFor="projeto-situacao">Situação</label><select id="projeto-situacao" value={filtro} onChange={(event) => setFiltro(event.target.value)}><option value="">Todas</option><option value="ATRASO">Com atraso</option><option value="EM_DIA">Sem atraso</option><option value="PENDENCIAS">Com providências</option><option value="SEM_TAREFAS">Sem tarefas</option></select></div>
          <div><label htmlFor="projeto-secretaria">Secretaria</label><select id="projeto-secretaria" value={secretaria} onChange={(event) => setSecretaria(event.target.value)}><option value="">Todas</option>{secretarias.map((nome) => <option key={nome} value={nome}>{nome}</option>)}</select></div>
        </div>
      </details>
      <p className="prefeito-projects__count" aria-live="polite">{visiveis.length} de {projetos.length} projetos</p>
      {visiveis.length ? (
        <div className="prefeito-projects__grid">
          {visiveis.map((projeto) => {
            const estado = situacao(projeto);
            const percentual = projeto.totalTarefas ? Math.round((projeto.concluidas / projeto.totalTarefas) * 100) : 0;
            return (
              <article key={projeto.id} className="prefeito-projects__card" style={{ ["--project-color" as string]: estado.cor }}>
                <div className="prefeito-projects__card-top"><span>{projeto.codigo}</span><strong>{estado.texto}</strong></div>
                <h3>{projeto.nome}</h3>
                <p>{projeto.secretaria}</p>
                <div className="prefeito-projects__progress"><span>Entregas concluídas</span><strong>{projeto.concluidas} de {projeto.totalTarefas}</strong><div role="img" aria-label={`${percentual}% das tarefas concluídas`}><i style={{ width: `${percentual}%` }} /></div></div>
                <div className="prefeito-projects__facts"><span>{projeto.estruturante ? "Estruturante" : CICLO[projeto.ciclo] || projeto.ciclo}</span><span>{projeto.atrasadas} em atraso</span><span>{projeto.pendencias} {projeto.pendencias === 1 ? "providência" : "providências"}</span></div>
                <Link href={`/iniciativas/${projeto.id}`} className="prefeito-projects__open">Abrir projeto →</Link>
              </article>
            );
          })}
        </div>
      ) : <div className="prefeito-projects__empty">{projetos.length ? "Nenhum projeto corresponde aos filtros. Ajuste a busca ou limpe os filtros." : "Ainda não há projetos cadastrados neste município."}</div>}
    </section>
  );
}
