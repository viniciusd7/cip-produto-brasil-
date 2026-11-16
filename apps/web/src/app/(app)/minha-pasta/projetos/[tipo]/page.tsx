import { notFound } from "next/navigation";
import { ListaProjetos } from "../lista";

const TIPOS = [
  "principais",
  "correlacionados",
  "estruturante",
  "prioritario",
  "plano-governo",
  "acao-diaria",
] as const;

export default async function ProjetosFiltradosPage({
  params,
}: {
  params: Promise<{ tipo: string }>;
}) {
  const { tipo } = await params;
  if (!TIPOS.includes(tipo as (typeof TIPOS)[number])) notFound();
  return <ListaProjetos tipo={tipo as (typeof TIPOS)[number]} />;
}
