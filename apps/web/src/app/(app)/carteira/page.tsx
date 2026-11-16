import { ListaCarteira } from "./lista";

export default function CarteiraPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; ciclo?: string }>;
}) {
  return <ListaCarteira searchParams={searchParams} />;
}
