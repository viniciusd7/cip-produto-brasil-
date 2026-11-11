"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@cip/ui";
import { canManageSecretariaRole, getNextStepForRole } from "@/lib/roles";
import { s } from "./ov";

export type CenarioSecretariaResponse = {
  data: {
    secretarias: Array<{
      id: string;
      nome: string;
      sigla?: string | null;
      titularNome?: string | null;
    }>;
    selected: {
      id: string;
      nome: string;
      sigla?: string | null;
      titularNome?: string | null;
      titularCargo?: string | null;
    } | null;
    metasEstrategicas: Array<{
      id: string;
      nome: string;
      codigo?: string | null;
      indicador?: string | null;
      valorBase?: string | null;
      alvo?: string | null;
      unidade?: string | null;
      perspectivaBsc?: string | null;
      resultadoChaveOkr?: string | null;
      projetos: number;
      desvio: number | null;
      aguardandoMedicao: boolean;
      medicaoAtual: {
        dataCorte: string;
        valorRealizado: string;
        valorEsperado: string | null;
        fonte: string | null;
      } | null;
    }>;
    metasExecucao: Array<{
      id: string;
      nome: string;
      indicador?: string | null;
      alvo?: string | null;
      valorAtual?: string | null;
      unidade?: string | null;
      prazo?: string | null;
      status: string;
      prazoStatus: string;
      iniciativaId: string;
      iniciativaNome: string;
      iniciativaCodigo: string;
      metaEstrategicaNome?: string | null;
    }>;
    indicadores: {
      projetos: number;
      metasExecucao: number;
      metasComValor: number;
      coberturaMetas: number;
      metasAtrasadas: number;
      totalTarefas: number;
      concluidas: number;
      atrasadas: number;
      semPrazo: number;
      noPrazo: number;
      pctConclusao: number;
    };
  };
  meta?: { dataReferencia?: string; fonte?: string };
};

function tonePrazo(st: string): "danger" | "warning" | "success" | "info" {
  if (st === "VENCIDO") return "danger";
  if (st === "SEM_PRAZO") return "warning";
  if (st === "CONCLUIDO") return "success";
  return "info";
}

export function CenarioSecretaria({
  payload,
  municipio,
  role,
}: {
  payload: CenarioSecretariaResponse;
  municipio: string;
  role?: string;
}) {
  const router = useRouter();
  const { secretarias, selected, metasEstrategicas, metasExecucao, indicadores } =
    payload.data;
  const nextStep = getNextStepForRole(role);
  const canManage = canManageSecretariaRole(role);
  const dataRef = payload.meta?.dataReferencia
    ? new Date(payload.meta.dataReferencia).toLocaleDateString("pt-BR", {
        timeZone: "UTC",
      })
    : "—";

  function onSelect(id: string) {
    router.push(`/painel?secretariaId=${id}`);
  }

  if (!selected) {
    return (
      <div className={s.board}>
        <header className={s.header}>
          <div>
            <span className={s.eyebrow}>Cenário</span>
            <p className={s.toplineTitle}>Cadastre uma secretaria</p>
            <p>{municipio}</p>
          </div>
          {canManage && (
            <Link href="/secretarias" className={s.button}>
              Gerir estrutura ↗
            </Link>
          )}
        </header>
      </div>
    );
  }

  return (
    <div className={s.board}>
      <header className={s.header}>
        <div>
          <span className={s.eyebrow}>Cenário · visão da secretaria</span>
          <p className={s.toplineTitle}>{selected.nome}</p>
          <p>
            {municipio}
            {selected.titularNome ? ` · ${selected.titularNome}` : ""}
            {selected.titularCargo ? ` · ${selected.titularCargo}` : ""}
          </p>
        </div>
        <div className={s.headerActions}>
          <span className={s.date}>◷ {dataRef}</span>
          <Link href="/painel" className={s.button}>
            Cenário geral
          </Link>
          {canManage && (
            <Link href={`/secretarias/${selected.id}`} className={s.button}>
              Gerir estrutura ↗
            </Link>
          )}
          <Link href={nextStep.href} className={s.button}>
            {nextStep.label} <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </header>

      <section id="secretarias" className={s.chapter} style={{ marginBottom: 20 }}>
        <div className={s.panel} style={{ padding: 16 }}>
          <p className={s.kicker}>Secretarias</p>
          <div className="chip-row" style={{ flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            {secretarias.map((sec) => (
              <button
                key={sec.id}
                type="button"
                className={sec.id === selected.id ? "cip-btn cip-btn--primary" : "cip-btn cip-btn--secondary"}
                onClick={() => onSelect(sec.id)}
              >
                {sec.sigla || sec.nome}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section id="meta-estrategica" className={s.chapter} style={{ marginBottom: 20 }}>
        <div className={s.panel} style={{ padding: 20 }}>
          <p className={s.kicker}>Meta estratégica</p>
          <h2 style={{ margin: "4px 0 14px", fontSize: 22 }}>Resultados da gestão</h2>
          <div className="dashboard-grid-3" style={{ gap: 12 }}>
            {metasEstrategicas.map((m) => (
              <article
                key={m.id}
                style={{ border: "1px solid var(--cip-border)", borderRadius: 12, padding: 14 }}
              >
                <strong>{m.nome}</strong>
                <p className="dashboard-muted" style={{ margin: "8px 0" }}>
                  {m.indicador || "Indicador a definir"}
                  {m.alvo ? ` · alvo ${m.alvo}${m.unidade ? ` ${m.unidade}` : ""}` : ""}
                  {m.valorBase ? ` · base ${m.valorBase}` : ""}
                </p>
                {m.perspectivaBsc && (
                  <p className="dashboard-muted">BSC: {m.perspectivaBsc}</p>
                )}
                {m.resultadoChaveOkr && (
                  <p className="dashboard-muted">OKR: {m.resultadoChaveOkr}</p>
                )}
                {m.aguardandoMedicao ? (
                  <p>Aguardando medição</p>
                ) : (
                  <p>
                    Realizado {m.medicaoAtual?.valorRealizado}
                    {m.medicaoAtual?.valorEsperado != null
                      ? ` · esperado ${m.medicaoAtual.valorEsperado}`
                      : ""}
                    {m.desvio != null
                      ? ` · desvio ${m.desvio > 0 ? "+" : ""}${m.desvio}`
                      : ""}
                  </p>
                )}
              </article>
            ))}
            {!metasEstrategicas.length && (
              <p className="dashboard-muted">
                Nenhuma meta estratégica vinculada a esta secretaria.{" "}
                <Link href="/planejamento">Abrir planejamento</Link>
              </p>
            )}
          </div>
        </div>
      </section>

      <section id="meta-execucao" className={s.chapter} style={{ marginBottom: 20 }}>
        <div className={s.panel} style={{ padding: 20 }}>
          <p className={s.kicker}>Meta de execução</p>
          <h2 style={{ margin: "4px 0 14px", fontSize: 22 }}>Entregas dos projetos</h2>
          <div className="stack" style={{ gap: 10 }}>
            {metasExecucao.map((m) => (
              <Link
                key={m.id}
                href={`/iniciativas/${m.iniciativaId}?aba=andamento`}
                style={{
                  display: "block",
                  border: "1px solid var(--cip-border)",
                  borderRadius: 12,
                  padding: 14,
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div className="chip-row" style={{ justifyContent: "space-between" }}>
                  <strong>{m.nome}</strong>
                  <Badge tone={tonePrazo(m.prazoStatus)}>
                    {m.prazoStatus.replace("_", " ")}
                  </Badge>
                </div>
                <p className="dashboard-muted" style={{ margin: "6px 0 0" }}>
                  {m.iniciativaCodigo} · {m.iniciativaNome}
                  {m.indicador ? ` · ${m.indicador}` : ""}
                  {m.valorAtual || m.alvo
                    ? ` · ${m.valorAtual || "—"} / ${m.alvo || "—"}`
                    : ""}
                </p>
              </Link>
            ))}
            {!metasExecucao.length && (
              <p className="dashboard-muted">Nenhuma meta de execução nesta secretaria.</p>
            )}
          </div>
        </div>
      </section>

      <section id="indicadores" className={s.chapter}>
        <div className={s.panel} style={{ padding: 20 }}>
          <p className={s.kicker}>Indicadores</p>
          <h2 style={{ margin: "4px 0 14px", fontSize: 22 }}>Leitura consolidada</h2>
          <div className="dashboard-grid-3" style={{ gap: 12 }}>
            <div style={{ border: "1px solid var(--cip-border)", borderRadius: 12, padding: 14 }}>
              <span className="dashboard-muted">Projetos</span>
              <p style={{ fontSize: 28, margin: "6px 0 0", fontWeight: 700 }}>
                {indicadores.projetos}
              </p>
            </div>
            <div style={{ border: "1px solid var(--cip-border)", borderRadius: 12, padding: 14 }}>
              <span className="dashboard-muted">Cobertura de metas</span>
              <p style={{ fontSize: 28, margin: "6px 0 0", fontWeight: 700 }}>
                {indicadores.coberturaMetas}%
              </p>
              <p className="dashboard-muted">
                {indicadores.metasComValor}/{indicadores.metasExecucao} com valor ·{" "}
                {indicadores.metasAtrasadas} atrasadas
              </p>
            </div>
            <div style={{ border: "1px solid var(--cip-border)", borderRadius: 12, padding: 14 }}>
              <span className="dashboard-muted">Tarefas</span>
              <p style={{ fontSize: 28, margin: "6px 0 0", fontWeight: 700 }}>
                {indicadores.pctConclusao}%
              </p>
              <p className="dashboard-muted">
                {indicadores.concluidas} concluídas · {indicadores.atrasadas} atrasadas ·{" "}
                {indicadores.semPrazo} sem prazo · {indicadores.noPrazo} no prazo
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
