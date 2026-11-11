import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Badge, Card, PageHeader, TableScroll } from "@cip/ui";
import { authOptions } from "@/lib/auth";
import { apiFetch, ApiError } from "@/lib/api";

type Implantacao = {
  data: {
    municipio: { nome: string; uf: string; prefeitoNome?: string | null; mandatoInicio?: string | null; mandatoFim?: string | null } | null;
    etapas: Array<{ id: string; titulo: string; feito: boolean; detalhe: string; href: string }>;
    concluidas: number;
    total: number;
    secretarias: Array<{ id: string; nome: string; sigla?: string | null; secretarios: string[]; metas: number; projetos: number }>;
  };
};

const ano = (iso?: string | null) => (iso ? new Date(iso).getFullYear() : null);

export default async function ImplantacaoPage() {
  const session = await getServerSession(authOptions);
  let payload: Implantacao;
  try {
    payload = await apiFetch<Implantacao>("/planejamento/implantacao", { token: session?.accessToken });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    if (err instanceof ApiError && err.status === 403) redirect("/");
    throw err;
  }
  const { municipio, etapas, concluidas, total, secretarias } = payload.data;
  const pct = total ? Math.round((concluidas / total) * 100) : 0;
  const proxima = etapas.find((e) => !e.feito);
  const mandato = [ano(municipio?.mandatoInicio), ano(municipio?.mandatoFim)].filter(Boolean).join("–");

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Implantação da prefeitura"
        title={municipio ? `${municipio.nome}/${municipio.uf}` : "Implantação"}
        description={[
          municipio?.prefeitoNome && `Prefeito(a): ${municipio.prefeitoNome}`,
          mandato && `Mandato ${mandato}`,
          "Siga as etapas para estruturar a gestão: equipe → plano → metas e indicadores → projetos → metas de execução → tarefas.",
        ]
          .filter(Boolean)
          .join(" · ")}
      />

      <Card
        title={`${concluidas} de ${total} etapas concluídas`}
        subtitle={proxima ? `Próximo passo: ${proxima.titulo.toLowerCase()}` : "Estrutura completa — acompanhe a execução e as validações."}
        action={proxima ? <Link className="cip-btn cip-btn--primary" href={proxima.href}>Continuar</Link> : <Link className="cip-btn cip-btn--primary" href="/validacoes">Ver validações</Link>}
      >
        <div className="projeto-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso da implantação">
          <div className="projeto-progress__bar" style={{ width: `${pct}%` }} />
        </div>
        <ol className="gp-steps">
          {etapas.map((e, i) => (
            <li key={e.id} className={`gp-steps__item${e.feito ? " is-done" : ""}${proxima?.id === e.id ? " is-next" : ""}`}>
              <span className="gp-steps__num" aria-hidden>{e.feito ? "✓" : i + 1}</span>
              <div className="gp-steps__body">
                <strong>{e.titulo}</strong>
                <span className="dashboard-muted">{e.detalhe}</span>
              </div>
              <Link className={`cip-btn ${e.feito ? "cip-btn--ghost" : "cip-btn--secondary"}`} href={e.href}>
                {e.feito ? "Revisar" : "Fazer agora"}
              </Link>
            </li>
          ))}
        </ol>
      </Card>

      <Card title="Secretarias da prefeitura" subtitle="Cada secretaria vira a pasta do secretário responsável, com metas, indicadores e tarefas.">
        {secretarias.length === 0 ? (
          <p className="dashboard-muted">Nenhuma secretaria cadastrada. <Link href="/secretarias">Cadastre as secretarias</Link> para começar.</p>
        ) : (
          <TableScroll>
            <table className="table">
              <thead>
                <tr>
                  <th>Secretaria</th>
                  <th>Secretário(s)</th>
                  <th>Metas estratégicas</th>
                  <th>Projetos</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {secretarias.map((s) => {
                  const pend = [!s.secretarios.length && "sem secretário", !s.metas && "sem metas", !s.projetos && "sem projetos"].filter(Boolean);
                  return (
                    <tr key={s.id}>
                      <td><Link href={`/secretarias/${s.id}`}>{s.sigla ? `${s.sigla} · ` : ""}{s.nome}</Link></td>
                      <td>{s.secretarios.join(", ") || <Badge tone="warning">A definir</Badge>}</td>
                      <td>{s.metas}</td>
                      <td>{s.projetos}</td>
                      <td>{pend.length ? <Badge tone="warning">{pend.join(" · ")}</Badge> : <Badge tone="success">Estruturada</Badge>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Card>
    </div>
  );
}
