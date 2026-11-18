import { getServerSession } from "next-auth";
import { Card, PageHeader } from "@cip/ui";
import { authOptions } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { canWriteRole } from "@/lib/roles";
import { PlanejamentoForm } from "./planejamento-form";
import { PlanoEstrutura, type Plano, type Responsavel, type Secretaria } from "./plano-estrutura";
import "./planejamento.css";

type PlanningResponse = { data: Plano[]; meta?: { fonte?: string } };

async function opcional<T>(p: Promise<{ data: T }>, vazio: T): Promise<T> {
  try {
    return (await p).data;
  } catch {
    return vazio;
  }
}

export default async function PlanejamentoPage() {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken || "";
  const podeEditar = canWriteRole(session?.user?.role);
  const [payload, secretarias, responsaveis] = await Promise.all([
    apiFetch<PlanningResponse>("/planejamento/resumo", { token }),
    podeEditar ? opcional(apiFetch<{ data: Secretaria[] }>("/admin/secretarias", { token }), []) : Promise.resolve([] as Secretaria[]),
    podeEditar ? opcional(apiFetch<{ data: Responsavel[] }>("/planejamento/responsaveis", { token }), []) : Promise.resolve([] as Responsavel[]),
  ]);
  return (
    <div className="stack gp-planejamento">
      <PageHeader
        title="Metas estratégicas e indicadores"
        description="Acompanhe as metas e os indicadores de cada secretaria."
      />
      <PlanoEstrutura
        planos={payload.data}
        token={token}
        secretarias={secretarias}
        responsaveis={responsaveis}
        podeEditar={podeEditar}
      />
      {!payload.data.length && (
        <Card title="Nenhum plano cadastrado">
          <p className="dashboard-muted">Registre o plano de governo vigente para começar.</p>
          {podeEditar && <PlanejamentoForm token={token} />}
        </Card>
      )}
      {podeEditar && payload.data.length > 0 && (
        <details className="gp-config">
          <summary>Planos de governo</summary>
          <PlanejamentoForm token={token} />
        </details>
      )}
    </div>
  );
}
