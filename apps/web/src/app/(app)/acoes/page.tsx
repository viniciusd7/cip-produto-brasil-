import { getServerSession } from "next-auth";
import { PageHeader } from "@cip/ui";
import { authOptions } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { canWriteRole } from "@/lib/roles";
import { AcaoForm } from "./acao-form";
import { TarefasGestao, type TarefaGestaoItem } from "../minha-pasta/tarefas-gestao";

type Projeto = { id: string; codigo: string; nome: string };

export default async function AcoesPage() {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken || "";
  const [agenda, projetos] = await Promise.all([
    apiFetch<{ data: { tarefas: TarefaGestaoItem[] } }>("/dashboard/agenda", { token }),
    apiFetch<{ data: Projeto[] }>("/iniciativas", { token }),
  ]);
  const podeEditar = canWriteRole(session?.user?.role);
  return (
    <div className="stack">
      <PageHeader title="Gerenciador de tarefas" description="Acompanhe a execução dos projetos por secretaria, responsável e prazo." />
      {podeEditar && <details className="more-block">
        <summary>+ Nova tarefa</summary>
        <AcaoForm token={token} iniciativas={projetos.data.map((projeto) => ({ id: projeto.id, label: `${projeto.codigo} · ${projeto.nome}` }))} />
      </details>}
      <TarefasGestao tarefas={agenda.data.tarefas} token={token} modo="PROJETOS" podeEditar={podeEditar} />
    </div>
  );
}
