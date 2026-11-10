import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { ApiError, apiFetch } from "@/lib/api";
import { NovoProjetoWizard } from "./novo-projeto-wizard";

type Secretarias = {
  data: Array<{
    id: string;
    nome: string;
    sigla?: string | null;
    titularNome?: string | null;
  }>;
};
type Modelos = {
  data: Array<{
    id: string;
    codigo: string;
    nome: string;
    descricao?: string | null;
    classificacoesPermitidas?: string[];
  }>;
};
type Metas = {
  data: Array<{
    id: string;
    nome: string;
    metas: Array<{ id: string; nome: string; codigo?: string | null }>;
  }>;
};

export default async function NovoProjetoPage({
  searchParams,
}: {
  searchParams: Promise<{ secretariaId?: string }>;
}) {
  const sp = await searchParams;
  const session = await getServerSession(authOptions);
  const token = session?.accessToken || "";
  if (!token) redirect("/login");

  let secs: Secretarias;
  try {
    secs = await apiFetch<Secretarias>("/admin/secretarias", { token });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }

  const [modelos, planos] = await Promise.all([
    apiFetch<Modelos>("/modelos-projeto", { token }).catch(() => ({ data: [] })),
    apiFetch<Metas>("/planejamento/resumo", { token }).catch(() => ({ data: [] })),
  ]);

  const metas = (planos.data || []).flatMap((p) =>
    p.metas.map((m) => ({
      id: m.id,
      label: `${m.codigo ? `${m.codigo} · ` : ""}${m.nome} · ${p.nome}`,
    })),
  );

  const modelosEstruturante = (modelos.data || []).filter(
    (m) =>
      m.codigo === "PROJETO_ESTRUTURANTE_PADRAO" ||
      m.codigo.startsWith("PROJETO_ESTRUTURANTE"),
  );

  return (
    <NovoProjetoWizard
      token={token}
      defaultSecretariaId={sp.secretariaId}
      secretarias={secs.data || []}
      modelos={modelosEstruturante}
      metas={metas}
      planos={(planos.data || []).map((p) => ({ id: p.id, nome: p.nome }))}
    />
  );
}
