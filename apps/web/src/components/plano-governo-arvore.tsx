import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, Card } from "@cip/ui";
import { ApiError, apiFetch } from "@/lib/api";

type ProjetoNo = {
  id: string;
  codigo: string;
  nome: string;
  secretaria: string;
};

type MetaNo = {
  id: string;
  nome: string;
  codigo?: string | null;
  secretaria?: { nome: string; sigla?: string | null } | null;
  responsavelUser?: { name: string } | null;
  indicadores?: Array<{ nome: string; alvo?: string | null }>;
  projetos?: ProjetoNo[];
};

type PlanoNo = {
  id: string;
  nome: string;
  periodo?: string | null;
  metas: MetaNo[];
};

type Resposta = {
  data: PlanoNo[];
  meta?: {
    projetosSemMeta?: ProjetoNo[];
    metasExternas?: Array<{
      id: string;
      nome: string;
      codigo?: string | null;
      projetos: ProjetoNo[];
    }>;
  };
};

function rotuloMeta(meta: { codigo?: string | null; nome: string }) {
  return meta.codigo ? `${meta.codigo} · ${meta.nome}` : meta.nome;
}

function detalheMeta(meta: MetaNo) {
  const secretaria = meta.secretaria?.sigla || meta.secretaria?.nome;
  const indicador = meta.indicadores?.[0];
  return [
    secretaria,
    meta.responsavelUser?.name,
    indicador?.nome,
    indicador?.alvo ? `alvo ${indicador.alvo}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function ProjetosDaMeta({ projetos }: { projetos: ProjetoNo[] }) {
  if (!projetos.length) {
    return <p className="dashboard-muted">Nenhum projeto vinculado a esta meta.</p>;
  }
  return (
    <div className="tree-children">
      {projetos.map((projeto) => (
        <Link key={projeto.id} href={`/iniciativas/${projeto.id}?aba=andamento`}>
          <Badge tone="info">
            {projeto.codigo} · {projeto.nome}
          </Badge>
          <span className="dashboard-muted"> {projeto.secretaria}</span>
        </Link>
      ))}
    </div>
  );
}

export async function PlanoGovernoArvore({ token }: { token: string }) {
  let payload: Resposta;
  try {
    payload = await apiFetch<Resposta>("/planejamento/resumo", { token });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }

  const planos = payload.data ?? [];
  const semMeta = payload.meta?.projetosSemMeta ?? [];
  const externas = payload.meta?.metasExternas ?? [];

  if (!planos.length && !semMeta.length && !externas.length) {
    return <p className="dashboard-muted">Nenhum plano de governo cadastrado.</p>;
  }

  return (
    <div className="stack">
      {!planos.length && (
        <p className="dashboard-muted">Nenhum plano de governo cadastrado.</p>
      )}
      {planos.map((plano) => (
        <Card
          key={plano.id}
          title={plano.nome}
          subtitle={[plano.periodo, `${plano.metas.length} meta(s) estratégica(s)`]
            .filter(Boolean)
            .join(" · ")}
        >
          {!plano.metas.length && (
            <p className="dashboard-muted">Este plano ainda não tem metas estratégicas.</p>
          )}
          {plano.metas.map((meta) => (
            <div key={meta.id} className="tree-block">
              <h4>{rotuloMeta(meta)}</h4>
              <div className="dashboard-muted">{detalheMeta(meta) || "Meta estratégica"}</div>
              <ProjetosDaMeta projetos={meta.projetos ?? []} />
            </div>
          ))}
        </Card>
      ))}
      {externas.length > 0 && (
        <Card
          title="Metas de outra secretaria"
          subtitle="Projetos desta pasta ligados a uma meta estratégica de outra área"
        >
          {externas.map((meta) => (
            <div key={meta.id} className="tree-block">
              <h4>{rotuloMeta(meta)}</h4>
              <ProjetosDaMeta projetos={meta.projetos} />
            </div>
          ))}
        </Card>
      )}
      {semMeta.length > 0 && (
        <Card title="Sem meta estratégica" subtitle="Projetos do plano ainda sem meta">
          <ProjetosDaMeta projetos={semMeta} />
        </Card>
      )}
    </div>
  );
}
