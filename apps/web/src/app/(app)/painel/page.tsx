import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { CenarioSecretaria, type CenarioSecretariaResponse } from "@/components/overview/cenario-secretaria";
import { GovernoOverview } from "@/components/overview/governo-overview";
import type { OverviewResponse } from "@/components/overview/types";
import { redirect } from "next/navigation";

export default async function PainelPage({
  searchParams,
}: {
  searchParams: Promise<{ secretariaId?: string }>;
}) {
  const sp = await searchParams;
  const session = await getServerSession(authOptions);
  const municipio = session?.user?.municipioNome || "Prefeitura conectada";
  const role = session?.user?.role;
  if (role === "gestor") redirect("/minha-pasta");

  if (sp.secretariaId) {
    const secretariaId = encodeURIComponent(sp.secretariaId);
    const payload = await apiFetch<CenarioSecretariaResponse>(
      `/dashboard/cenario-secretaria?secretariaId=${secretariaId}`,
      { token: session?.accessToken },
    );
    return <CenarioSecretaria payload={payload} municipio={municipio} role={role} />;
  }

  const payload = await apiFetch<OverviewResponse>("/dashboard/resumo", {
    token: session?.accessToken,
  });
  return <GovernoOverview payload={payload} municipio={municipio} role={role} />;
}
