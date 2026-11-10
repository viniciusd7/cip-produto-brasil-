/** Rótulo legível para selects e chips (nome completo primeiro). */
export function secretariaLabel(s: {
  nome: string;
  sigla?: string | null;
  titularNome?: string | null;
}) {
  const base = s.sigla ? `${s.nome} (${s.sigla})` : s.nome;
  return s.titularNome ? `${base} · ${s.titularNome}` : base;
}

export function secretariaChipLabel(s: {
  nome: string;
  sigla?: string | null;
}) {
  return s.sigla ? `${s.nome} (${s.sigla})` : s.nome;
}
