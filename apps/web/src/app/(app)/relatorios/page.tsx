import { RelatorioConteudo } from "./relatorio-view";

export default function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <RelatorioConteudo secao="visao" searchParams={searchParams} />;
}
