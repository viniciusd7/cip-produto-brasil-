import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { Breadcrumbs, PageHeader } from "@cip/ui";
import { authOptions } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import {
  canSubmitEvidenceRole,
  canValidateRole,
  canWriteRole,
} from "@/lib/roles";
import { ProjetoDocumento, type ProjetoDocData, type SecretariaRef } from "./projeto-documento";
import type { ResponsavelOpcao } from "../../minha-pasta/tarefas-edicao";

type DetailResponse = { data: ProjetoDocData & {
  descricao?: string | null;
  origem?: string | null;
  fonte?: string | null;
  dataReferencia?: string | null;
  confiabilidade?: string | null;
  compromissos?: Array<{ compromisso: { titulo: string; codigo?: string | null } }>;
  equipamentos?: Array<{
    equipamentoId: string;
    tipoVinculo: string;
    validado: boolean;
    equipamento: { id: string; nome: string; tipo?: string | null };
  }>;
  marcos?: Array<{ id: string; descricao: string }>;
}};

export default async function IniciativaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  let payload: DetailResponse;
  try {
    payload = await apiFetch<DetailResponse>(`/iniciativas/${id}`, {
      token: session?.accessToken,
    });
  } catch {
    notFound();
  }
  const item = payload.data;
  const token = session?.accessToken || "";
  const canWrite = canWriteRole(session?.user?.role);
  const canSubmitEvidence = canSubmitEvidenceRole(session?.user?.role);
  const canValidate = canValidateRole(session?.user?.role);
  const focoSecretario = session?.user?.role === "gestor";
  const portfolioHref = focoSecretario ? "/minha-pasta/projetos" : "/carteira";
  const portfolioLabel = "Projetos";

  const [todasSecretarias, responsaveis] = await Promise.all([
    apiFetch<{ data: SecretariaRef[] }>("/admin/secretarias", { token }).catch(() => ({
      data: [] as SecretariaRef[],
    })),
    canWrite
      ? apiFetch<{ data: ResponsavelOpcao[] }>("/planejamento/responsaveis", { token })
      : Promise.resolve({ data: [] as ResponsavelOpcao[] }),
  ]);

  return (
    <div className="stack">
      <Breadcrumbs
        items={[
          { label: portfolioLabel, href: portfolioHref },
          { label: item.codigo },
        ]}
      />
      <PageHeader
        eyebrow={`Projeto ${item.codigo}`}
        title={item.nome}
        description={
          item.descricao ||
          "Tarefas e subtarefas do projeto, com as evidências de cada entrega."
        }
        actions={
          <Link
            href={portfolioHref}
            style={{ color: "var(--cip-blue)", fontWeight: 600 }}
          >
            ← {portfolioLabel}
          </Link>
        }
      />

      <Suspense fallback={<p className="dashboard-muted">Carregando documento…</p>}>
        <ProjetoDocumento
          item={item}
          canWrite={canWrite}
          canSubmitEvidence={canSubmitEvidence}
          canValidate={canValidate}
          token={token}
          responsaveis={responsaveis.data}
          usuarioId={session?.user?.id || ""}
          administrador={session?.user?.role === "admin"}
          todasSecretarias={todasSecretarias.data || []}
          focoSecretario={focoSecretario}
        />
      </Suspense>
    </div>
  );
}
