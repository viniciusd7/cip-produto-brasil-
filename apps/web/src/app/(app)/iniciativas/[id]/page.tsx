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
  const portfolioHref =
    session?.user?.role === "gestor" ? "/minha-pasta" : "/carteira";
  const portfolioLabel =
    session?.user?.role === "gestor" ? "Minha secretaria" : "Projetos";

  // Equipe das pastas envolvidas (sugestões de responsável) e lista de secretarias
  // para vincular correlacionadas.
  const envolvidas = [
    item.secretariaPrincipal.id,
    ...item.secretarias.map((s) => s.secretaria.id),
  ];
  const [todasSecretarias, equipes] = await Promise.all([
    apiFetch<{ data: SecretariaRef[] }>("/admin/secretarias", { token }).catch(() => ({
      data: [] as SecretariaRef[],
    })),
    Promise.all(
      envolvidas.map((id) =>
        apiFetch<{ data: Array<{ nome: string }> }>(`/admin/secretarias/${id}/pessoas`, {
          token,
        }).catch(() => ({ data: [] as Array<{ nome: string }> })),
      ),
    ),
  ]);
  const equipe = Array.from(
    new Set(equipes.flatMap((e) => e.data.map((p) => p.nome))),
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));

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
          "Tarefas organizadas em pastas por meta de execução, com as evidências de cada entrega."
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
          equipe={equipe}
          todasSecretarias={todasSecretarias.data || []}
        />
      </Suspense>
    </div>
  );
}
