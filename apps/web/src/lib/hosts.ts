/**
 * A CIP opera em dois endereços separados:
 * - gestao.<domínio>: console interno da equipe CIP (prefeituras, consultores, prefeitos);
 * - <domínio>: ambiente das prefeituras (consultor, prefeito, secretários).
 * Defina GESTAO_HOST para fixar o host do console; sem ele, vale o prefixo "gestao.".
 *
 * Em localhost ou IP privado da rede, o console fica em /gestao no mesmo host —
 * cookies de sessão não cruzam localhost ↔ gestao.localhost.
 */
export function isGestaoHost(host?: string | null) {
  if (!host) return false;
  const h = host.toLowerCase();
  const configured = process.env.GESTAO_HOST?.toLowerCase();
  return configured ? h === configured : h.startsWith("gestao.");
}

/** Local sem subdomínio: evita redirect cross-host que perde a sessão. */
export function isLocalSameOriginHost(host?: string | null) {
  if (!host) return false;
  const h = host.toLowerCase().split(":")[0];
  if (h === "localhost" || h === "127.0.0.1") return true;
  const octets = h.split(".").map(Number);
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(h) || octets.some((value) => value > 255)) return false;
  return octets[0] === 10 ||
    (octets[0] === 192 && octets[1] === 168) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31);
}

function proto(host: string) {
  return isLocalSameOriginHost(host) || /^(localhost|127\.|[^.]+\.localhost)/.test(host) ? "http" : "https";
}

export function gestaoUrl(host: string) {
  if (isLocalSameOriginHost(host)) {
    return `${proto(host)}://${host}/gestao`;
  }
  return (
    process.env.NEXT_PUBLIC_GESTAO_URL ||
    `${proto(host)}://gestao.${host.replace(/^(www|app)\./, "")}`
  );
}

export function prefeituraUrl(host: string) {
  return process.env.NEXT_PUBLIC_APP_URL || `${proto(host)}://${host.replace(/^gestao\./, "")}`;
}
