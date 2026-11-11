"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/api";
import { getHomeForRole, getRoleLabel } from "@/lib/roles";

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

type TenantSwitchResponse = {
  data: {
    accessToken: string;
    user: {
      role: string;
      municipioId: string;
      municipioNome: string;
    };
  };
};

export function TenantSwitcher({
  initialMunicipio,
}: {
  initialMunicipio?: string | null;
}) {
  const router = useRouter();
  const { data: session, update } = useSession();
  const [contexts, setContexts] = useState<ContextResponse["data"] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session?.accessToken) return;
    let active = true;

    void apiFetch<ContextResponse>("/auth/contexts", {
      token: session.accessToken,
    })
      .then((result) => {
        if (active) setContexts(result.data);
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
    if (!session?.accessToken || !contexts) return;
    setError("");
    try {
      const result = await apiFetch<TenantSwitchResponse>("/auth/select-tenant", {
        method: "POST",
        token: session.accessToken,
        body: JSON.stringify({ municipioId: municipioId || null }),
      });
      await update({ accessToken: result.data.accessToken });
      setContexts({
        ...contexts,
        activeMunicipioId: result.data.user.municipioId || null,
      });
      router.push(getHomeForRole(result.data.user.role));
      router.refresh();
    } catch (cause) {
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
          value={activeMunicipioId}
          onChange={(event) => void onChange(event.target.value)}
        >
          {contexts.isPlatformAdmin && (
            <option value="">Gestão central CIP</option>
          )}
          {contexts.tenants.map((tenant) => (
            <option key={tenant.id} value={tenant.id}>
              {tenant.nome} ({tenant.uf})
            </option>
          ))}
        </select>
      </label>
      <small>
        {activeMunicipioId ? getRoleLabel(activeRole) : "Administração da plataforma"}
        {" · "}{activeLabel}
      </small>
      {error && <small role="status">{error}</small>}
    </>
  );
}
