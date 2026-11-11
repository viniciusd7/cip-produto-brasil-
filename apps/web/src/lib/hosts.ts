/**
 * A CIP opera em dois endereços separados:
 * - gestao.<domínio>: console interno da equipe CIP (prefeituras, consultores, prefeitos);
 * - <domínio>: ambiente das prefeituras (consultor, prefeito, secretários).
 * Defina GESTAO_HOST para fixar o host do console; sem ele, vale o prefixo "gestao.".
 */
export function isGestaoHost(host?: string | null) {
  if (!host) return false;
  const h = host.toLowerCase();
  const configured = process.env.GESTAO_HOST?.toLowerCase();
  return configured ? h === configured : h.startsWith("gestao.");
}

function proto(host: string) {
  return /^(localhost|127\.|[^.]+\.localhost)/.test(host) ? "http" : "https";
}

export function gestaoUrl(host: string) {
  return (
    process.env.NEXT_PUBLIC_GESTAO_URL ||
    `${proto(host)}://gestao.${host.replace(/^(www|app)\./, "")}`
  );
}

export function prefeituraUrl(host: string) {
  return process.env.NEXT_PUBLIC_APP_URL || `${proto(host)}://${host.replace(/^gestao\./, "")}`;
}
