import Link from "next/link";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { Card, PageHeader } from "@cip/ui";
import { authOptions } from "@/lib/auth";
import { ApiError, apiFetch } from "@/lib/api";
import { canWriteRole, getHomeForRole } from "@/lib/roles";
import { ContinuarRascunho } from "./continuar-rascunho";
import { NovoProjetoWizard } from "./novo-projeto-wizard";

const TIPOS = {
  estruturante: {
    classificacao: "ESTRUTURANTE",
    nome: "Projeto estruturante",
    descricao: "Projeto de maior porte, com análise de viabilidade e etapas de preparação.",
  },
  prioritario: {
    classificacao: "PRIORITARIO",
    nome: "Projeto prioritário",
    descricao: "Projeto prioritário acompanhado pelo mesmo roteiro estruturante.",
  },
  "plano-governo": {
    classificacao: "PLANO_GOVERNO",
    nome: "Plano de governo",
    descricao: "Compromisso estratégico ligado a uma meta do plano de governo.",
  },
  "acao-diaria": {
    classificacao: "ACAO_DIARIA",
    nome: "Ação diária",
    descricao: "Demanda operacional, com foco na providência e no prazo.",
  },
} as const;

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
  searchParams: Promise<{ secretariaId?: string; tipo?: string }>;
}) {
  const sp = await searchParams;
  const session = await getServerSession(authOptions);
  const token = session?.accessToken || "";
  if (!token || !session?.user.id || !session.user.municipioId) redirect("/login");
  if (!canWriteRole(session?.user?.role)) redirect(getHomeForRole(session?.user?.role));

  if (!sp.tipo) {
    return (
      <div className="stack">
        <PageHeader
          eyebrow="Projetos"
          title="Escolha o fluxo de criação"
          description="Cada tipo tem perguntas próprias e será salvo em uma categoria exclusiva."
        />
        <p className="dashboard-muted">Se você deixou um cadastro incompleto neste navegador, escolha o mesmo tipo para retomar seu rascunho automaticamente.</p>
        <Card>
          <div className="wizard-choice">
            {Object.entries(TIPOS).map(([tipo, item]) => (
              <Link
                key={tipo}
                href={`/minha-pasta/novo?tipo=${tipo}${
                  sp.secretariaId
                    ? `&secretariaId=${encodeURIComponent(sp.secretariaId)}`
                    : ""
                }`}
                className="wizard-choice__link"
              >
                <strong>{item.nome}</strong>
                <p>{item.descricao}</p>
                <ContinuarRascunho usuarioId={session.user.id} municipioId={session.user.municipioId} classificacao={item.classificacao} />
              </Link>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (!Object.hasOwn(TIPOS, sp.tipo)) notFound();
  const tipo = TIPOS[sp.tipo as keyof typeof TIPOS];

  let secs: Secretarias;
  try {
    secs = await apiFetch<Secretarias>("/admin/secretarias", { token });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }

  let modelos: Modelos;
  let planos: Metas;
  try {
    [modelos, planos] = await Promise.all([
      tipo.classificacao === "ESTRUTURANTE" || tipo.classificacao === "PRIORITARIO"
        ? apiFetch<Modelos>("/modelos-projeto", { token })
        : Promise.resolve({ data: [] }),
      tipo.classificacao === "PLANO_GOVERNO"
        ? apiFetch<Metas>("/planejamento/resumo", { token })
        : Promise.resolve({ data: [] }),
    ]);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }

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
      key={`${session.user.id}:${session.user.municipioId}:${tipo.classificacao}`}
      token={token}
      usuarioId={session.user.id}
      municipioId={session.user.municipioId}
      initialClassification={tipo.classificacao}
      defaultSecretariaId={sp.secretariaId}
      secretarias={secs.data || []}
      modelos={modelosEstruturante}
      metas={metas}
      planos={(planos.data || []).map((p) => ({ id: p.id, nome: p.nome }))}
    />
  );
}
