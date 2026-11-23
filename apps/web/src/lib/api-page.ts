import { redirect } from "next/navigation";
import { ApiError, apiFetch } from "./api";

/** Páginas e layouts são renderizados em paralelo: cada chamada trata sua sessão. */
export async function apiFetchForPage<T>(
  path: string,
  options: RequestInit & { token?: string; returnTo?: string } = {},
): Promise<T> {
  const { returnTo = "/painel", ...request } = options;
  try {
    return await apiFetch<T>(path, request);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      const destination = returnTo.startsWith("/") && !returnTo.startsWith("//") && !returnTo.includes("\\")
        ? returnTo : "/painel";
      redirect(`/login?callbackUrl=${encodeURIComponent(destination)}`);
    }
    throw error;
  }
}
