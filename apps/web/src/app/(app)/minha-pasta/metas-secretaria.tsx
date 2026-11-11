import Link from "next/link";
import { Badge } from "@cip/ui";

type IndicadorPasta = {
  id: string;
  nome: string;
  unidade?: string | null;
  valorBase?: string | null;
  alvo?: string | null;
  valorAtual?: string | null;
  periodicidade?: string | null;
  responsavel?: { name: string } | null;
  ultimaMedicao?: string | null;
  progresso: number | null;
};

export type MetaEstrategicaPasta = {
  id: string;
  codigo?: string | null;
  nome: string;
  plano: string;
  prazo: string | null;
  responsavel?: { name: string } | null;
  projetos: number;
  pctExecucao: number;
  indicadores: IndicadorPasta[];
};

export type MetaExecucaoPasta = {
  id: string;
  codigo?: string | null;
  nome: string;
  alvo?: string | null;
  valorAtual?: string | null;
  unidade?: string | null;
  prazo: string | null;
  responsavel?: { name: string } | null;
  participacao: "PRINCIPAL" | "CORRELACIONADO";
  projeto: { id: string; codigo: string; nome: string };
  tarefas: { total: number; concluidas: number; atrasadas: number };
  pctConclusao: number;
};

const data = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : null);

function Barra({ pct, label }: { pct: number; label: string }) {
  return (
    <div className="projeto-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="projeto-progress__bar" style={{ width: `${pct}%` }} />
    </div>
  );
}

function toneProgresso(p: number | null) {
  if (p === null) return "neutral" as const;
  return p >= 70 ? ("success" as const) : p >= 35 ? ("warning" as const) : ("danger" as const);
}

export function MetasSecretaria({
  estrategicas,
  execucao,
}: {
  estrategicas: MetaEstrategicaPasta[];
  execucao: MetaExecucaoPasta[];
}) {
  const indicadores = estrategicas.reduce((acc, m) => acc + m.indicadores.length, 0);
  return (
    <>
      <section className="pasta-section" aria-labelledby="metas-estrategicas-title">
        <div className="pasta-section__head">
          <div>
            <h2 id="metas-estrategicas-title">Metas estratégicas e indicadores</h2>
            <p>Compromissos do plano de governo sob responsabilidade da secretaria — definidos pela consultoria.</p>
          </div>
          <div className="gestao-tarefas__summary">
            <span><strong>{estrategicas.length}</strong> metas</span>
            <span><strong>{indicadores}</strong> indicadores</span>
          </div>
        </div>
        {estrategicas.length === 0 ? (
          <div className="pasta-empty"><p>A consultoria ainda não vinculou metas do plano de governo a esta secretaria.</p></div>
        ) : (
          <div className="gp-metas">
            {estrategicas.map((m) => (
              <article key={m.id} className="gp-meta">
                <header className="gp-meta__head">
                  <Badge tone="info">{m.codigo || "META"}</Badge>
                  <Badge tone={m.projetos ? "success" : "warning"}>{m.projetos} projeto{m.projetos === 1 ? "" : "s"}</Badge>
                </header>
                <h3 className="gp-meta__title">{m.nome}</h3>
                <span className="dashboard-muted" style={{ fontSize: 12 }}>
                  {[m.plano, m.prazo && `prazo ${data(m.prazo)}`, `responsável: ${m.responsavel?.name || "a definir"}`].filter(Boolean).join(" · ")}
                </span>
                <div className="gp-meta__exec">
                  <span>Execução dos projetos</span>
                  <strong>{m.pctExecucao}%</strong>
                </div>
                <Barra pct={m.pctExecucao} label={`Execução da meta ${m.nome}`} />
                <div className="gp-meta__section">
                  {m.indicadores.length === 0 && <p className="dashboard-muted" style={{ margin: 0 }}>Sem indicador cadastrado.</p>}
                  {m.indicadores.map((ind) => {
                    const un = ind.unidade ? ` ${ind.unidade}` : "";
                    return (
                      <div key={ind.id} className="projeto-indicador-chip">
                        <div className="projeto-indicador-chip__head">
                          <strong>{ind.nome}</strong>
                          <Badge tone={toneProgresso(ind.progresso)}>{ind.progresso === null ? "sem medição" : `${ind.progresso}%`}</Badge>
                        </div>
                        <div className="gp-ind__metrics">
                          <span><small>Base</small>{ind.valorBase ? `${ind.valorBase}${un}` : "—"}</span>
                          <span><small>Atual</small>{ind.valorAtual ? `${ind.valorAtual}${un}` : "—"}</span>
                          <span><small>Alvo</small>{ind.alvo ? `${ind.alvo}${un}` : "—"}</span>
                        </div>
                        {ind.progresso !== null && <Barra pct={ind.progresso} label={`Progresso de ${ind.nome}`} />}
                        <span className="dashboard-muted" style={{ fontSize: 12 }}>
                          {[ind.periodicidade?.toLowerCase(), ind.ultimaMedicao ? `medido em ${data(ind.ultimaMedicao)}` : "aguardando 1ª medição", ind.responsavel?.name].filter(Boolean).join(" · ")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="pasta-section" aria-labelledby="metas-execucao-title">
        <div className="pasta-section__head">
          <div>
            <h2 id="metas-execucao-title">Metas de execução</h2>
            <p>Entregas dos projetos da secretaria e dos projetos em que ela participa.</p>
          </div>
        </div>
        {execucao.length === 0 ? (
          <div className="pasta-empty"><p>Nenhuma meta de execução cadastrada nos projetos da secretaria.</p></div>
        ) : (
          <ul className="gp-exec">
            {execucao.map((m) => (
              <li key={m.id} className="gp-exec__item">
                <div className="gp-exec__main">
                  <div className="chip-row">
                    {m.codigo && <Badge tone="info">{m.codigo}</Badge>}
                    <Badge tone={m.participacao === "PRINCIPAL" ? "neutral" : "violet"}>{m.participacao === "PRINCIPAL" ? "Da secretaria" : "Correlacionado"}</Badge>
                    {m.tarefas.atrasadas > 0 && <Badge tone="danger">{m.tarefas.atrasadas} atrasada{m.tarefas.atrasadas === 1 ? "" : "s"}</Badge>}
                  </div>
                  <strong>{m.nome}</strong>
                  <Link href={`/iniciativas/${m.projeto.id}`} className="dashboard-muted">{m.projeto.codigo} · {m.projeto.nome}</Link>
                </div>
                <div className="gp-exec__stats">
                  <span className="dashboard-muted">{m.tarefas.concluidas}/{m.tarefas.total} tarefas · {data(m.prazo) || "sem prazo"}</span>
                  <Barra pct={m.pctConclusao} label={`Conclusão de ${m.nome}`} />
                  <span className="dashboard-muted" style={{ fontSize: 12 }}>
                    {[m.alvo && `alvo ${m.alvo}${m.unidade ? ` ${m.unidade}` : ""}`, `responsável: ${m.responsavel?.name || "a definir"}`].filter(Boolean).join(" · ")}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
