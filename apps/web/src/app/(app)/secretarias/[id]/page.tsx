import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { Badge, Breadcrumbs, Card, PageHeader } from "@cip/ui";
import { authOptions } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { canEditSecretariaRole } from "@/lib/roles";
import { EquipeAddForm, EquipeLista, type PessoaPasta } from "./equipe-form";
import { TitularForm } from "./titular-form";

type Detail = {
  data: {
    id: string;
    nome: string;
    sigla?: string | null;
    titularNome?: string | null;
    titularCargo?: string | null;
    titularTelefone?: string | null;
    titularEmail?: string | null;
    pessoas?: PessoaPasta[];
    metas: Array<{
      id: string;
      nome: string;
      codigo?: string | null;
      plano: { nome: string };
      iniciativas: Array<{ id: string; codigo: string; nome: string }>;
    }>;
    iniciativas: Array<{
      id: string;
      codigo: string;
      nome: string;
      ciclo: string;
      estruturante: boolean;
      metaEstrategica?: { nome: string } | null;
      _count: { marcos: number; metasExecucao: number };
      atualizadoEm: string;
    }>;
  };
};

export default async function SecretariaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  let payload: Detail;
  try {
    payload = await apiFetch<Detail>(`/admin/secretarias/${id}`, {
      token: session?.accessToken,
    });
  } catch {
    notFound();
  }
  const s = payload.data;
  const canWrite = canEditSecretariaRole(session?.user?.role);

  return (
    <div className="stack">
      <Breadcrumbs
        items={[
          { label: "Cenário", href: "/painel" },
          { label: "Pastas", href: "/secretarias" },
          { label: s.nome },
        ]}
      />
      <PageHeader
        eyebrow={s.sigla || "Secretaria"}
        title={s.nome}
        description="Hub da pasta: equipe, metas estratégicas e projetos vinculados."
      />

      <Card
        title="Identidade da pasta"
        subtitle="Nome, sigla e titular — a prefeitura define quem responde pela secretaria"
      >
        <div className="chip-row" style={{ marginBottom: 12 }}>
          <Badge tone="info">{s.sigla || "Sem sigla"}</Badge>
          <Badge tone="neutral">{s.titularNome || "Sem titular"}</Badge>
          {s.titularTelefone && <Badge tone="neutral">{s.titularTelefone}</Badge>}
          {s.titularCargo && <Badge tone="gold">{s.titularCargo}</Badge>}
        </div>
        {canWrite ? (
          <TitularForm
            token={session?.accessToken || ""}
            secretariaId={s.id}
            initial={{
              nome: s.nome,
              sigla: s.sigla,
              titularNome: s.titularNome,
              titularCargo: s.titularCargo,
              titularTelefone: s.titularTelefone,
              titularEmail: s.titularEmail,
            }}
          />
        ) : (
          <p className="dashboard-muted">
            {s.titularEmail || "Somente leitura — titular definido pela gestão."}
          </p>
        )}
      </Card>

      <Card
        title="Equipe da pasta"
        subtitle="Titular e funcionários que podem ser responsáveis de projetos"
      >
        <EquipeLista
          pessoas={s.pessoas || []}
          canWrite={canWrite}
          token={session?.accessToken || ""}
          secretariaId={s.id}
        />
        {canWrite && (
          <div style={{ marginTop: 12 }}>
            <EquipeAddForm
              token={session?.accessToken || ""}
              secretariaId={s.id}
            />
          </div>
        )}
      </Card>

      <Card title="Metas estratégicas">
        {!s.metas.length && <p className="dashboard-muted">Nenhuma meta cadastrada.</p>}
        <div className="stack">
          {s.metas.map((m) => (
            <div key={m.id} className="tree-block">
              <h4>
                {m.codigo ? `${m.codigo} · ` : ""}
                {m.nome}
              </h4>
              <div className="dashboard-muted">Plano: {m.plano.nome}</div>
              <div className="tree-children">
                {m.iniciativas.map((i) => (
                  <Link key={i.id} href={`/iniciativas/${i.id}`}>
                    <Badge tone="info">
                      {i.codigo} · {i.nome}
                    </Badge>
                  </Link>
                ))}
                {!m.iniciativas.length && (
                  <span className="dashboard-muted">Sem projetos vinculados</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Projetos da secretaria">
        <div className="mobile-only">
          {s.iniciativas.map((i) => (
            <Link key={i.id} href={`/iniciativas/${i.id}`}>
              <article className="entity-card" style={{ marginBottom: 8 }}>
                <div className="entity-card__top">
                  <strong>
                    {i.codigo} · {i.nome}
                  </strong>
                  {i.estruturante && <Badge tone="rose">Estruturante</Badge>}
                </div>
                <div className="dashboard-muted">
                  {i.ciclo} · {i._count.metasExecucao} metas exec. · {i._count.marcos}{" "}
                  tarefas
                </div>
              </article>
            </Link>
          ))}
        </div>
        <div className="desktop-only">
          <table className="table" style={{ minWidth: 0 }}>
            <thead>
              <tr>
                <th>Código</th>
                <th>Projeto</th>
                <th>Meta estratégica</th>
                <th>Desdobramento</th>
              </tr>
            </thead>
            <tbody>
              {s.iniciativas.map((i) => (
                <tr key={i.id}>
                  <td>{i.codigo}</td>
                  <td>
                    <Link href={`/iniciativas/${i.id}`}>{i.nome}</Link>
                  </td>
                  <td>{i.metaEstrategica?.nome || "—"}</td>
                  <td>
                    {i._count.metasExecucao} metas · {i._count.marcos} tarefas
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
