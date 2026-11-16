import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { PageHeader } from "@cip/ui";
import { authOptions } from "@/lib/auth";
import { canWriteRole } from "@/lib/roles";
import { PlanoGovernoArvore } from "@/components/plano-governo-arvore";
import { ListaCarteira } from "../lista";

const TIPOS = [
  "estruturante",
  "prioritario",
  "plano-governo",
  "acao-diaria",
] as const;

export default async function CarteiraTipoPage({
  params,
  searchParams,
}: {
  params: Promise<{ tipo: string }>;
  searchParams: Promise<{ q?: string; ciclo?: string }>;
}) {
  const { tipo } = await params;
  if (!TIPOS.includes(tipo as (typeof TIPOS)[number])) notFound();

  if (tipo === "plano-governo") {
    const session = await getServerSession(authOptions);
    const podeCadastrar = canWriteRole(session?.user?.role);
    return (
      <div className="stack">
        <PageHeader
          eyebrow="Projetos"
          title="Plano de governo"
          description="Metas estratégicas do plano e os projetos ligados a cada uma."
          actions={
            podeCadastrar ? (
              <div className="chip-row">
                <Link
                  href="/minha-pasta/novo?tipo=plano-governo"
                  className="cip-btn cip-btn--primary"
                >
                  Novo projeto
                </Link>
                <Link href="/planejamento" className="cip-btn cip-btn--secondary">
                  Editar metas
                </Link>
              </div>
            ) : undefined
          }
        />
        <PlanoGovernoArvore token={session?.accessToken || ""} />
      </div>
    );
  }

  return (
    <ListaCarteira
      searchParams={searchParams}
      classificacao={
        tipo === "acao-diaria"
          ? "ACAO_DIARIA"
          : tipo === "prioritario"
            ? "PRIORITARIO"
            : "ESTRUTURANTE"
      }
    />
  );
}
