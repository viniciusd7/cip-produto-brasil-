"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/api";
import { getRoleLabel } from "@/lib/roles";
import { changeTenantSession } from "@/lib/tenant-session";

type TenantOption = {
  id: string;
  nome: string;
  uf: string;
  role: string;
  secretariaId?: string | null;
};

type ContextResponse = {
  data: {
    isPlatformAdmin: boolean;
    activeMunicipioId: string | null;
    tenants: TenantOption[];
  };
};

export function TenantSwitcher({
  initialMunicipio,
}: {
  initialMunicipio?: string | null;
}) {
  const { data: session, update } = useSession();
  const [contexts, setContexts] = useState<ContextResponse["data"] | null>(null);
  const [error, setError] = useState("");
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (!session?.accessToken) return;
    let active = true;

    void apiFetch<ContextResponse>("/auth/contexts", {
      token: session.accessToken,
    })
      .then((result) => {
        if (active) {
          setContexts(result.data);
          setError("");
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Não foi possível carregar as prefeituras.",
          );
        }
      });

    return () => {
      active = false;
    };
  }, [session?.accessToken]);

  async function onChange(municipioId: string) {
    if (!session?.accessToken || !contexts || switching) return;
    setError("");
    setSwitching(true);
    try {
      const home = await changeTenantSession({
        session,
        municipioId,
        update,
      });
      // Reinicia o cache e o estado local também ao trocar de /painel para /painel.
      window.location.replace(home);
    } catch (cause) {
      setSwitching(false);
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível trocar de prefeitura.",
      );
    }
  }

  if (
    !contexts ||
    (!contexts.isPlatformAdmin && contexts.tenants.length <= 1)
  ) {
    return (
      <>
        <strong>
          {session?.user?.isPlatformAdmin && !session.user.municipioId
            ? "Gestão central CIP"
            : session?.user?.municipioNome || initialMunicipio || "Prefeitura"}
        </strong>
        {session?.user?.role === "leitura" && (
          <small>Este vínculo permite apenas consulta. Para executar alterações, solicite acesso de consultor à administração.</small>
        )}
        {error && <small role="status">{error}</small>}
      </>
    );
  }

  const activeMunicipioId = session?.user?.municipioId || "";
  const activeLabel = activeMunicipioId
    ? session?.user?.municipioNome || initialMunicipio || "Prefeitura"
    : "Gestão central CIP";
  const activeRole = contexts.tenants.find(
    (tenant) => tenant.id === activeMunicipioId,
  )?.role;

  return (
    <>
      <label className="tenant-switcher">
        <span>Ambiente ativo</span>
        <select
          aria-label="Trocar prefeitura"
          disabled={switching}
          aria-busy={switching}
          value={activeMunicipioId}
          onChange={(event) => void onChange(event.target.value)}
        >
          {contexts.isPlatformAdmin && (
            <option value="">Gestão central CIP</option>
          )}
          {contexts.tenants.map((tenant) => (
            <option key={tenant.id} value={tenant.id}>
              {tenant.nome} ({tenant.uf}) — {getRoleLabel(tenant.role)}
            </option>
          ))}
        </select>
      </label>
      <small>
        {activeMunicipioId ? getRoleLabel(activeRole) : "Administração da plataforma"}
        {" · "}{activeLabel}
      </small>
      {activeMunicipioId && activeRole === "leitura" && (
        <small>Este vínculo permite apenas consulta. Para executar alterações, solicite acesso de consultor à administração.</small>
      )}
      {error && <small role="status">{error}</small>}
    </>
  );
}
