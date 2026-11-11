import Link from "next/link";
import { getServerSession } from "next-auth";
import { Badge, Card, PageHeader } from "@cip/ui";
import { authOptions } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

type DashboardResponse = {
  data: {
    projetos: Array<{
      id: string;
      codigo: string;
      nome: string;
      ciclo: string;
      estruturante: boolean;
      bloqueioLabel: string | null;
      atualizadoEm: string;
      secretariaPrincipal: { id: string; nome: string };
      secretariasCorrelacionadas: Array<{
        papel: string;
        secretaria: { id: string; nome: string };
      }>;
      tarefas: {
        total: number;
        concluidas: number;
        atrasadas: number;
        semPrazo: number;
        noPrazo: number;
        pctConclusao: number;
      };
      providenciasAbertas: {
        impedimentos: number;
        evidencias: number;
        verificacoes: number;
        decisoes: number;
      };
    }>;
    tarefas: Array<{
      id: string;
      codigo: string | null;
      descricao: string;
      status: string;
      responsavel: string | null;
      prazo: string | null;
      meta: string | null;
      subtarefas: { total: number; concluidas: number };
      iniciativaId: string;
      iniciativaCodigo: string;
      iniciativaNome: string;
      secretaria: string;
    }>;
    pendencias: Array<{
      id: string;
      tipo: string;
      titulo: string;
      status: string;
      responsavel?: string | null;
      prazo?: string | null;
      iniciativaId: string;
      iniciativaNome: string;
      href?: string;
    }>;
  };
};

export default async function PendenciasPage() {
  const session = await getServerSession(authOptions);
  const payload = await apiFetch<DashboardResponse>("/dashboard/agenda", {
    token: session?.accessToken,
  });
  const taskQueue = payload.data.tarefas;
  const projectQueue = payload.data.projetos;
  const openActions = payload.data.pendencias;
  const tasksByProject = new Map<string, typeof taskQueue>();
  for (const task of taskQueue) {
    const projectTasks = tasksByProject.get(task.iniciativaId) ?? [];
    projectTasks.push(task);
    tasksByProject.set(task.iniciativaId, projectTasks);
  }
  const statusLabel: Record<string, string> = {
    VENCIDO: "Atrasada",
    NO_PRAZO: "No prazo",
    SEM_PRAZO: "Sem prazo",
    CONCLUIDO: "Concluída",
    ENCERRADO_SEM_SOLUCAO: "Encerrada sem solução",
  };
  const statusTone = (status: string) =>
    status === "VENCIDO"
      ? "danger"
      : status === "CONCLUIDO"
        ? "success"
        : status === "NO_PRAZO"
          ? "info"
          : "warning";
  const cycleLabel = (cycle: string) =>
    cycle.replaceAll("_", " ").toLocaleLowerCase("pt-BR");
  const asDate = (date: string) =>
    new Date(date).toLocaleDateString("pt-BR");

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Tarefas, pendências e decisões"
        title="Agenda de execução"
        description="Visão completa dos projetos, tarefas, prazos, responsáveis, secretarias envolvidas e providências que exigem acompanhamento."
      />

      <Card title={`${projectQueue.length} projetos · ${taskQueue.length} tarefas`}>
        {projectQueue.length ? (
          <div className="agenda-projetos">
            {projectQueue.map((projeto) => {
              const tarefasProjeto = tasksByProject.get(projeto.id) ?? [];
              const providencias =
                projeto.providenciasAbertas.impedimentos +
                projeto.providenciasAbertas.evidencias +
                projeto.providenciasAbertas.verificacoes +
                projeto.providenciasAbertas.decisoes;
              return (
                <article key={projeto.id} className="agenda-projeto">
                  <div className="agenda-projeto__header">
                    <div>
                      <p className="agenda-projeto__eyebrow">
                        {projeto.codigo} · {cycleLabel(projeto.ciclo)}
                      </p>
                      <h2>{projeto.nome}</h2>
                    </div>
                    <div className="agenda-projeto__badges">
                      {projeto.estruturante && (
                        <Badge tone="rose">Estruturante</Badge>
                      )}
                      {projeto.bloqueioLabel && (
                        <Badge tone="danger">{projeto.bloqueioLabel}</Badge>
                      )}
                      <Link
                        href={`/iniciativas/${projeto.id}?aba=andamento`}
                        className="cip-btn cip-btn--secondary"
                      >
                        Abrir projeto
                      </Link>
                    </div>
                  </div>

                  <p className="agenda-projeto__secretarias">
                    <strong>Responsável:</strong>{" "}
                    {projeto.secretariaPrincipal.nome}
                    {projeto.secretariasCorrelacionadas.length > 0 && (
                      <>
                        {" · "}
                        <strong>Correlacionadas:</strong>{" "}
                        {projeto.secretariasCorrelacionadas
                          .map((item) => item.secretaria.nome)
                          .join(", ")}
                      </>
                    )}
                  </p>

                  <div
                    className="agenda-projeto__progress"
                    role="progressbar"
                    aria-label={`Conclusão das tarefas de ${projeto.nome}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={projeto.tarefas.pctConclusao}
                  >
                    <div className="agenda-projeto__progress-label">
                      <span>
                        {projeto.tarefas.concluidas} de {projeto.tarefas.total}{" "}
                        tarefas concluídas
                      </span>
                      <strong>{projeto.tarefas.pctConclusao}%</strong>
                    </div>
                    <span className="agenda-projeto__progress-track">
                      <span
                        style={{
                          width: `${projeto.tarefas.pctConclusao}%`,
                        }}
                      />
                    </span>
                  </div>

                  <div className="agenda-projeto__metrics">
                    <span>
                      <strong>{projeto.tarefas.atrasadas}</strong> atrasadas
                    </span>
                    <span>
                      <strong>{projeto.tarefas.noPrazo}</strong> no prazo
                    </span>
                    <span>
                      <strong>{projeto.tarefas.semPrazo}</strong> sem prazo
                    </span>
                    <span>
                      <strong>{providencias}</strong> providências abertas
                    </span>
                  </div>

                  <details className="agenda-projeto__details">
                    <summary>
                      Ver tarefas e subtarefas ({tarefasProjeto.length})
                    </summary>
                    {tarefasProjeto.length ? (
                      <div className="table-scroll">
                        <table className="table">
                          <thead>
                            <tr>
                              <th>Situação</th>
                              <th>Tarefa</th>
                              <th>Meta e subtarefas</th>
                              <th>Responsável</th>
                              <th>Prazo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tarefasProjeto.map((task) => (
                              <tr key={`${task.status}-${task.id}`}>
                                <td>
                                  <Badge tone={statusTone(task.status)}>
                                    {statusLabel[task.status] || task.status}
                                  </Badge>
                                </td>
                                <td style={{ fontWeight: 600 }}>
                                  {task.codigo ? `${task.codigo} · ` : ""}
                                  {task.descricao}
                                </td>
                                <td>
                                  {task.meta || "Sem meta vinculada"}
                                  <div className="dashboard-muted">
                                    {task.subtarefas.total
                                      ? `${task.subtarefas.concluidas}/${task.subtarefas.total} subtarefas`
                                      : "Sem subtarefas"}
                                  </div>
                                </td>
                                <td>{task.responsavel || "—"}</td>
                                <td>{task.prazo ? asDate(task.prazo) : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="dashboard-muted">
                        Este projeto ainda não tem tarefas cadastradas.
                      </p>
                    )}
                  </details>

                  <p className="agenda-projeto__updated">
                    Atualizado em {asDate(projeto.atualizadoEm)}
                  </p>
                </article>
              );
            })}
          </div>
        ) : (
          <p>Nenhum projeto encontrado neste escopo.</p>
        )}
      </Card>

      <Card title={`${openActions.length} providências abertas`}>
        <table className="table">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Descrição</th>
              <th>Iniciativa</th>
              <th>Responsável</th>
              <th>Prazo</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {openActions.map((p) => (
              <tr key={`${p.tipo}-${p.id}`}>
                <td>
                  <Badge tone={p.tipo === "EVIDENCIA" ? "gold" : "neutral"}>
                    {p.tipo === "EVIDENCIA" ? "Evidência" : p.tipo}
                  </Badge>
                </td>
                <td style={{ fontWeight: 600 }}>
                  <Link
                    href={
                      p.href ||
                      `/iniciativas/${p.iniciativaId}${
                        p.tipo === "EVIDENCIA" ? "?aba=evidencias" : ""
                      }`
                    }
                    style={{ color: "inherit", textDecoration: "none" }}
                  >
                    {p.titulo}
                  </Link>
                </td>
                <td>
                  <Link
                    href={`/iniciativas/${p.iniciativaId}`}
                    style={{ color: "var(--cip-blue)" }}
                  >
                    {p.iniciativaNome}
                  </Link>
                </td>
                <td>{p.responsavel || "—"}</td>
                <td>
                  {p.prazo
                    ? new Date(p.prazo).toLocaleDateString("pt-BR")
                    : "—"}
                </td>
                <td>
                  <Badge tone="warning">{p.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!openActions.length && (
          <p>Nenhuma providência aberta para os projetos deste escopo.</p>
        )}
      </Card>
    </div>
  );
}
