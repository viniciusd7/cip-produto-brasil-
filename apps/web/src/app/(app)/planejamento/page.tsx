import Link from "next/link";
import { getServerSession } from "next-auth";
import { Card, PageHeader, SourceMeta } from "@cip/ui";
import { authOptions } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { canValidateRole } from "@/lib/roles";
import { PlanejamentoForm } from "./planejamento-form";
import { ConhecimentoForm } from "./conhecimento-form";
import { PlanoEstrutura, type Plano, type Responsavel, type Secretaria, type Sugestao } from "./plano-estrutura";

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
  const podeEditar = canValidateRole(session?.user?.role);
  const [payload, secretarias, responsaveis, sugestoes] = await Promise.all([
    apiFetch<PlanningResponse>("/planejamento/resumo", { token }),
    podeEditar ? opcional(apiFetch<{ data: Secretaria[] }>("/admin/secretarias", { token }), []) : Promise.resolve([] as Secretaria[]),
    podeEditar ? opcional(apiFetch<{ data: Responsavel[] }>("/planejamento/responsaveis", { token }), []) : Promise.resolve([] as Responsavel[]),
    podeEditar ? opcional(apiFetch<{ data: Sugestao[] }>("/planejamento/sugestoes", { token }), []) : Promise.resolve([] as Sugestao[]),
  ]);
  const metasFlat = payload.data.flatMap((p) => p.metas.map((m) => ({ id: m.id, nome: m.nome })));

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Plano de governo"
        title="Plano → metas estratégicas → indicadores"
        description="O consultor estrutura o plano do prefeito: cada meta estratégica tem secretaria e responsável, indicadores mensuráveis e se desdobra em projetos, metas de execução e tarefas."
      />
      <SourceMeta fonte={payload.meta?.fonte} confiabilidade="Estrutura configurável por prefeitura" />
      <div className="gp-flow" aria-label="Hierarquia da gestão">
        {["Plano de governo", "Meta estratégica + indicadores", "Projeto", "Meta de execução", "Tarefa", "Subtarefa"].map((etapa, i) => (
          <span key={etapa} className="gp-flow__step">{i > 0 && <span aria-hidden>→</span>}{etapa}</span>
        ))}
      </div>
      {podeEditar && (
        <div className="chip-row">
          <PlanejamentoForm token={token} />
          <Link href="/minha-pasta/novo" className="cip-btn cip-btn--secondary">+ Projeto a partir de uma meta</Link>
        </div>
      )}
      <PlanoEstrutura
        planos={payload.data}
        token={token}
        secretarias={secretarias}
        responsaveis={responsaveis}
        sugestoes={sugestoes}
        podeEditar={podeEditar}
      />
      {!payload.data.length && (
        <Card title="Nenhum plano cadastrado">
          <p className="dashboard-muted">O primeiro passo da implantação é registrar o plano de governo vigente.</p>
        </Card>
      )}
      {podeEditar && <ConhecimentoForm token={token} metas={metasFlat} />}
    </div>
  );
}
