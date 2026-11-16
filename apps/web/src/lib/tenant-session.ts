import type { Session } from "next-auth";
import { apiFetch } from "./api";
import { getHomeForRole } from "./roles";

type TenantSwitchResponse = {
  data: {
    accessToken: string;
    user: { id: string; role: string; municipioId: string };
  };
};

export async function changeTenantSession({
  session,
  municipioId,
  update,
}: {
  session: Session;
  municipioId: string;
  update: (data: { accessToken: string }) => Promise<Session | null>;
}): Promise<string> {
  const { data } = await apiFetch<TenantSwitchResponse>("/auth/select-tenant", {
    method: "POST",
    token: session.accessToken,
    body: JSON.stringify({ municipioId: municipioId || null }),
  });
  if (data.user.id !== session.user.id || data.user.municipioId !== municipioId) {
    throw new Error("A prefeitura retornada não corresponde ao contexto solicitado.");
  }
  const updated = await update({ accessToken: data.accessToken });
  if (
    updated?.accessToken !== data.accessToken ||
    updated?.user.id !== session.user.id ||
    updated?.user.municipioId !== municipioId ||
    updated?.user.role !== data.user.role
  ) {
    throw new Error("Não foi possível confirmar a sessão da prefeitura selecionada.");
  }
  return getHomeForRole(updated.user.role);
}
