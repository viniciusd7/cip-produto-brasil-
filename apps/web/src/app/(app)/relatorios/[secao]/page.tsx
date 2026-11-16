import { notFound } from "next/navigation";
import { RelatorioConteudo, type SecaoRelatorio } from "../relatorio-view";

const SECOES = ["secretarias", "metas", "projetos", "tarefas", "evidencias"] as const;

export default async function RelatorioSecaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ secao: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { secao } = await params;
  if (!SECOES.includes(secao as (typeof SECOES)[number])) notFound();
  return (
    <RelatorioConteudo
      secao={secao as SecaoRelatorio}
      searchParams={searchParams}
    />
  );
}
