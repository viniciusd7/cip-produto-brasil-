/** getRandomValues também funciona no acesso HTTP pela rede local. */
export function criarEnvioId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Links de avisos só abrem páginas da própria aplicação. */
export function linkInternoAviso(link?: string | null): string | null {
  return link?.startsWith("/") && !link.startsWith("//") && !/[\\\x00-\x1f\x7f]/.test(link) ? link : null;
}
