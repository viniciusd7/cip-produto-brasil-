import { prisma } from "@cip/db";

export type NoRef = { tipo: string; id: string };

function keyOf(n: NoRef) {
  return `${n.tipo}:${n.id}`;
}

/** Detecta ciclo se adicionar aresta origem → destino (sentido: origem bloqueia destino). */
export async function criariaCiclo(
  municipioId: string,
  origem: NoRef,
  destino: NoRef,
): Promise<boolean> {
  if (keyOf(origem) === keyOf(destino)) return true;

  const edges = await prisma.dependenciaVinculo.findMany({
    where: {
      municipioId,
      status: { in: ["PENDENTE", "VALIDADO"] },
      tipo: "IMPEDITIVA",
    },
    select: { origemTipo: true, origemId: true, destinoTipo: true, destinoId: true },
  });

  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const from = keyOf({ tipo: e.origemTipo, id: e.origemId });
    const to = keyOf({ tipo: e.destinoTipo, id: e.destinoId });
    const list = adj.get(from) ?? [];
    list.push(to);
    adj.set(from, list);
  }
  const fromNew = keyOf(origem);
  const toNew = keyOf(destino);
  const list = adj.get(fromNew) ?? [];
  list.push(toNew);
  adj.set(fromNew, list);

  const start = toNew;
  const target = fromNew;
  const seen = new Set<string>();
  const stack = [start];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === target) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const nxt of adj.get(cur) ?? []) stack.push(nxt);
  }
  return false;
}
