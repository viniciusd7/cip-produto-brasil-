import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import {
  CenarioSecretaria,
  type CenarioSecretariaResponse,
} from "@/components/overview/cenario-secretaria";

export default async function PainelPage({
  searchParams,
}: {
  searchParams: Promise<{ secretariaId?: string }>;
}) {
  const sp = await searchParams;
  const session = await getServerSession(authOptions);
  const qs = sp.secretariaId ? `?secretariaId=${sp.secretariaId}` : "";
  const payload = await apiFetch<CenarioSecretariaResponse>(
    `/dashboard/cenario-secretaria${qs}`,
    { token: session?.accessToken },
  );
  return (
    <CenarioSecretaria
      payload={payload}
      municipio={session?.user?.municipioNome || "Prefeitura conectada"}
      role={session?.user?.role}
    />
  );
}
