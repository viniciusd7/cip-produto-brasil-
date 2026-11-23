import { getServerSession } from "next-auth";
import { PageHeader } from "@cip/ui";
import { authOptions } from "@/lib/auth";
import { CentralComunicacao } from "@/components/central-comunicacao";

export default async function ComunicadosPage({ searchParams }: { searchParams: Promise<{ aba?: string; projeto?: string; iniciativaId?: string }> }) {
  const [session, query] = await Promise.all([getServerSession(authOptions), searchParams]);
  return <div className="stack">
    <PageHeader eyebrow="Projetos e equipe" title="Comunicação" description="Converse no contexto de cada projeto e acompanhe os avisos que precisam da sua atenção." />
    <CentralComunicacao token={session?.accessToken || ""} aba={query.aba === "avisos" ? "avisos" : "conversas"} projetoId={typeof query.projeto === "string" ? query.projeto : typeof query.iniciativaId === "string" ? query.iniciativaId : undefined} />
  </div>;
}
