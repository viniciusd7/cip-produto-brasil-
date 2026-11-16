export type RelacaoDependenciaDirecionada = {
  origemIniciativaId: string;
  destinoIniciativaId: string;
};

export function relacaoCriariaCiclo(
  edges: RelacaoDependenciaDirecionada[],
  origemId: string,
  destinoId: string,
): boolean {
  if (origemId === destinoId) return true;

  const destinos = new Map<string, string[]>();
  for (const edge of edges) {
    const current = destinos.get(edge.origemIniciativaId) ?? [];
    current.push(edge.destinoIniciativaId);
    destinos.set(edge.origemIniciativaId, current);
  }

  const vistos = new Set<string>();
  const pendentes = [destinoId];
  while (pendentes.length) {
    const atual = pendentes.pop()!;
    if (atual === origemId) return true;
    if (vistos.has(atual)) continue;
    vistos.add(atual);
    pendentes.push(...(destinos.get(atual) ?? []));
  }
  return false;
}
