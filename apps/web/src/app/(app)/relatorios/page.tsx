import { getServerSession } from "next-auth";
import { toneClassPasta as classTone, toneGravidade } from "@cip/shared";
import { Badge, Card, PageHeader, TableScroll } from "@cip/ui";
import { authOptions } from "@/lib/auth";
import { apiFetch, API_URL } from "@/lib/api";
import { ExportButtons } from "./export-buttons";

type Report = {
  data: {
    geradoEm: string;
    metodoVersao: string;
    observacao: string;
    porSecretaria: Array<{
      id: string;
      nome: string;
      sigla?: string | null;
      classificacao: string;
      kpis: {
        totalTarefas: number;
        abertas: number;
        atrasadas: number;
        pctAtraso: number;
        indicePonderado: number;
        semPrazo: number;
        diasSemAtualizacao: number | null;
      };
      projetos: Array<{
        id: string;
        codigo: string;
        nome: string;
        totalTarefas: number;
        atrasadas: number;
        pctAtraso: number;
      }>;
      pedemAcao: {
        atrasadas: Array<{
          id: string;
          descricao: string;
          projeto: string;
          gravidade?: string | null;
        }>;
        vencemEm15d: Array<{ id: string; descricao: string; projeto: string }>;
        semPrazo: Array<{ id: string; descricao: string; projeto: string }>;
      };
    }>;
  };
};

export default async function RelatoriosPage() {
  const session = await getServerSession(authOptions);
  const report = await apiFetch<Report>("/reports/executivo.json", {
    token: session?.accessToken,
  });

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Prestação de contas"
        title="Relatório por secretaria"
        description={report.data.observacao}
        actions={
          <ExportButtons
            csvUrl={`${API_URL}/reports/executivo.csv`}
            token={session?.accessToken || ""}
          />
        }
      />

      <div className="chip-row">
        <Badge tone="info">
          Gerado em {new Date(report.data.geradoEm).toLocaleString("pt-BR")}
        </Badge>
        <Badge tone="gold">Método {report.data.metodoVersao}</Badge>
      </div>

      <Card title="Matriz executiva">
        <div className="mobile-only">
          {report.data.porSecretaria
            .filter((s) => s.kpis.totalTarefas > 0)
            .map((s) => (
              <article key={s.id} className="entity-card" style={{ marginBottom: 10 }}>
                <div className="entity-card__top">
                  <strong>{s.nome}</strong>
                  <Badge tone={classTone(s.classificacao)}>{s.classificacao}</Badge>
                </div>
                <div className="dashboard-muted">
                  {s.kpis.atrasadas} atrasadas · {s.kpis.pctAtraso}% · índice{" "}
                  {s.kpis.indicePonderado}%
                </div>
              </article>
            ))}
        </div>
        <div className="desktop-only">
          <TableScroll>
            <table className="table">
              <thead>
                <tr>
                  <th>Secretaria</th>
                  <th>Total</th>
                  <th>Abertas</th>
                  <th>Atrasadas</th>
                  <th>% atraso</th>
                  <th>Índice</th>
                  <th>Sem prazo</th>
                  <th>Classificação</th>
                </tr>
              </thead>
              <tbody>
                {report.data.porSecretaria
                  .filter((s) => s.kpis.totalTarefas > 0)
                  .map((s) => (
                    <tr key={s.id}>
                      <td>{s.nome}</td>
                      <td>{s.kpis.totalTarefas}</td>
                      <td>{s.kpis.abertas}</td>
                      <td>{s.kpis.atrasadas}</td>
                      <td>{s.kpis.pctAtraso}%</td>
                      <td>{s.kpis.indicePonderado}%</td>
                      <td>{s.kpis.semPrazo}</td>
                      <td>
                        <Badge tone={classTone(s.classificacao)}>
                          {s.classificacao}
                        </Badge>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </TableScroll>
        </div>
      </Card>

      {report.data.porSecretaria
        .filter((s) => s.kpis.totalTarefas > 0)
        .map((s) => (
          <Card
            key={s.id}
            title={`${s.sigla || s.nome} · tarefas que pedem ação`}
            subtitle={`Classificação: ${s.classificacao}`}
          >
            <div className="dashboard-grid-3">
              <div>
                <h4 style={{ marginTop: 0 }}>Atrasadas</h4>
                {s.pedemAcao.atrasadas.slice(0, 5).map((t) => (
                  <div key={t.id} className="dashboard-list-item">
                    <div>
                      <strong>{t.descricao}</strong>
                      <div className="dashboard-muted">{t.projeto}</div>
                    </div>
                    {t.gravidade && (
                      <Badge tone={toneGravidade(t.gravidade)}>{t.gravidade}</Badge>
                    )}
                  </div>
                ))}
                {!s.pedemAcao.atrasadas.length && (
                  <p className="dashboard-muted">Nenhuma</p>
                )}
              </div>
              <div>
                <h4 style={{ marginTop: 0 }}>Vencem em 15 dias</h4>
                {s.pedemAcao.vencemEm15d.slice(0, 5).map((t) => (
                  <div key={t.id} className="dashboard-list-item">
                    <div>
                      <strong>{t.descricao}</strong>
                      <div className="dashboard-muted">{t.projeto}</div>
                    </div>
                  </div>
                ))}
                {!s.pedemAcao.vencemEm15d.length && (
                  <p className="dashboard-muted">Nenhuma</p>
                )}
              </div>
              <div>
                <h4 style={{ marginTop: 0 }}>Sem prazo</h4>
                {s.pedemAcao.semPrazo.slice(0, 5).map((t) => (
                  <div key={t.id} className="dashboard-list-item">
                    <div>
                      <strong>{t.descricao}</strong>
                      <div className="dashboard-muted">{t.projeto}</div>
                    </div>
                  </div>
                ))}
                {!s.pedemAcao.semPrazo.length && (
                  <p className="dashboard-muted">Nenhuma</p>
                )}
              </div>
            </div>
            {!!s.projetos.length && (
              <div style={{ marginTop: 16 }}>
                <h4>Projetos da pasta</h4>
                <div className="chip-row">
                  {s.projetos.map((p) => (
                    <Badge key={p.id} tone={p.atrasadas ? "warning" : "info"}>
                      {p.codigo}: {p.atrasadas}/{p.totalTarefas} atrasadas
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </Card>
        ))}
    </div>
  );
}
