/** Converte "1.234,5", "45%", "R$ 10" em número; null quando não numérico. */
export function numeroIndicador(valor: string | null | undefined): number | null {
  if (!valor) return null;
  let s = valor.replace(/[^\d,.-]/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** % do caminho entre linha de base e alvo (funciona para MAIOR_MELHOR e MENOR_MELHOR). */
export function progressoIndicador(ind: {
  valorBase?: string | null;
  alvo?: string | null;
  valorAtual?: string | null;
}): number | null {
  const base = numeroIndicador(ind.valorBase) ?? 0;
  const alvo = numeroIndicador(ind.alvo);
  const atual = numeroIndicador(ind.valorAtual);
  if (alvo === null || atual === null || alvo === base) return null;
  const pct = ((atual - base) / (alvo - base)) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}
