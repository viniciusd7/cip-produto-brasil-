export type ClassificacaoProjeto =
  | "ESTRUTURANTE"
  | "PRIORITARIO"
  | "PLANO_GOVERNO"
  | "ACAO_DIARIA";

/** Projetos antigos sem o campo entram na pasta de estruturantes. */
export function classificacaoDoProjeto(valor?: string | null): ClassificacaoProjeto {
  if (
    valor === "PRIORITARIO" ||
    valor === "PLANO_GOVERNO" ||
    valor === "ACAO_DIARIA"
  ) {
    return valor;
  }
  return "ESTRUTURANTE";
}
