import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { GovernoOverview } from "@/components/overview/governo-overview";
import type { OverviewResponse } from "@/components/overview/types";

export default async function PainelPage() {
  const session = await getServerSession(authOptions);
  const payload = await apiFetch<OverviewResponse>("/dashboard/resumo", {
    token: session?.accessToken,
  });
  return (
    <GovernoOverview
      payload={payload}
      municipio={session?.user?.municipioNome || "Prefeitura conectada"}
      role={session?.user?.role}
    />
  );
}
