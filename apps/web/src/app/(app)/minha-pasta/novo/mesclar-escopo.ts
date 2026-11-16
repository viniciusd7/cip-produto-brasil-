import type { EscopoNo } from "./escopo-editor";

export function mesclarEscopo(anterior: EscopoNo[], novo: EscopoNo[]): EscopoNo[] {
  const antigos = new Map(anterior.map((n) => [n.codigo, n]));
  const doModelo = novo.map((n) => {
    const antigo = antigos.get(n.codigo);
    if (!antigo) return n;
    return {
      ...n,
      nome: antigo.nome,
      responsavel: antigo.responsavel,
      prazo: antigo.prazo,
      children: mesclarEscopo(antigo.children, n.children),
    };
  });
  const codigosNovos = new Set(novo.map((n) => n.codigo));
  const manuais = anterior.filter((n) => n.manual && !codigosNovos.has(n.codigo));
  return [...doModelo, ...manuais];
}
