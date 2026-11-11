import { getServerSession } from "next-auth";
import { Card, PageHeader, SourceMeta, Badge } from "@cip/ui";
import { authOptions } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { PlanejamentoForm } from "./planejamento-form";
import { ConhecimentoForm } from "./conhecimento-form";

type PlanningResponse = {
  data: Array<{
    id: string;
    nome: string;
    periodo?: string | null;
    descricao?: string | null;
    metas: Array<{
      id: string;
      codigo?: string | null;
      nome: string;
      descricao?: string | null;
      indicador?: string | null;
      alvo?: string | null;
      perspectivaBsc?: string | null;
      resultadoChaveOkr?: string | null;
      iniciativas: number;
      secretaria?: { nome: string; sigla?: string | null } | null;
    }>;
  }>;
  meta?: { fonte?: string };
};

export default async function PlanejamentoPage() {
  const session = await getServerSession(authOptions);
  const payload = await apiFetch<PlanningResponse>("/planejamento/resumo", { token: session?.accessToken });
  const metasFlat = payload.data.flatMap((p) => p.metas.map((m) => ({ id: m.id, nome: m.nome })));

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Módulo de planejamento"
        title="Plano de governo → metas → projetos"
        description="Cadastre a estrutura estratégica da prefeitura antes de abrir a execução. Cada município enxerga e mantém apenas seu próprio plano."
      />
      <SourceMeta fonte={payload.meta?.fonte} confiabilidade="Estrutura configurável por prefeitura" />
      <PlanejamentoForm token={session?.accessToken || ""} />
      <ConhecimentoForm token={session?.accessToken || ""} metas={metasFlat} />
      {payload.data.map((plano) => (
        <Card key={plano.id} title={plano.nome} subtitle={[plano.periodo, plano.descricao].filter(Boolean).join(" · ") || "Plano sem descrição cadastrada"}>
          <div className="dashboard-grid-3">
            {plano.metas.map((meta) => (
              <div key={meta.id} style={{ border: "1px solid var(--cip-border)", borderRadius: 14, padding: 16, background: "rgba(255,255,255,0.025)" }}>
                <div className="chip-row" style={{ justifyContent: "space-between" }}>
                  <Badge tone="info">{meta.codigo || "META"}</Badge>
                  <Badge tone={meta.iniciativas ? "success" : "warning"}>{meta.iniciativas} projeto{meta.iniciativas === 1 ? "" : "s"}</Badge>
                </div>
                <h3 style={{ margin: "16px 0 6px", fontSize: 17 }}>{meta.nome}</h3>
                <p className="dashboard-muted" style={{ minHeight: 38 }}>{meta.descricao || "Sem descrição operacional."}</p>
                <div className="dashboard-muted">Unidade responsável: {meta.secretaria?.sigla || meta.secretaria?.nome || "A definir"}</div>
                {(meta.indicador || meta.alvo || meta.perspectivaBsc || meta.resultadoChaveOkr) && (
                  <div className="dashboard-muted" style={{ marginTop: 8 }}>
                    {[meta.indicador && `Indicador: ${meta.indicador}`, meta.alvo && `Alvo: ${meta.alvo}`, meta.perspectivaBsc && `BSC: ${meta.perspectivaBsc}`, meta.resultadoChaveOkr && `OKR: ${meta.resultadoChaveOkr}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                )}
              </div>
            ))}
            {!plano.metas.length && <p className="dashboard-muted">Adicione a primeira meta estratégica para começar a organizar a carteira.</p>}
          </div>
        </Card>
      ))}
      {!payload.data.length && <Card title="Nenhum plano cadastrado"><p className="dashboard-muted">O primeiro passo da implantação é registrar o plano de governo vigente.</p></Card>}
    </div>
  );
}
