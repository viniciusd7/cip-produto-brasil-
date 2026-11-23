import { getServerSession } from "next-auth";
import { PageHeader } from "@cip/ui";
import { authOptions } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { canWriteRole } from "@/lib/roles";
import { AcaoForm } from "./acao-form";
import { TarefasGestao, type TarefaGestaoItem } from "../minha-pasta/tarefas-gestao";

type Projeto = { id: string; codigo: string; nome: string };
type Responsavel = { id: string; name: string; secretaria?: { nome: string; sigla?: string | null } | null };

export default async function AcoesPage() {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken || "";
  const podeEditar = canWriteRole(session?.user?.role);
  const secretario = session?.user?.role === "gestor";
  const [agenda, projetos, responsaveis] = await Promise.all([
    apiFetch<{ data: { tarefas: TarefaGestaoItem[] } }>("/dashboard/agenda", { token }),
    apiFetch<{ data: Projeto[] }>("/iniciativas", { token }),
    podeEditar
      ? apiFetch<{ data: Responsavel[] }>("/planejamento/responsaveis", { token })
      : Promise.resolve({ data: [] as Responsavel[] }),
  ]);
  return (
    <div className="stack">
      <PageHeader title={secretario ? "Tarefas da secretaria" : "Gerenciador de tarefas"} description={secretario ? "Acompanhe as tarefas da sua pasta, registre evidências, reprograme prazos e informe entregas à consultoria." : "Crie tarefas e subtarefas, atribua responsáveis e acompanhe os prazos dos projetos."} />
      {podeEditar && <details className="more-block">
        <summary>+ Criar tarefa ou subtarefa</summary>
        <AcaoForm token={token} iniciativas={projetos.data.map((projeto) => ({ id: projeto.id, label: `${projeto.codigo} · ${projeto.nome}` }))} tarefas={agenda.data.tarefas} responsaveis={responsaveis.data} usuarioId={session?.user?.id || ""} administrador={session?.user?.role === "admin"} />
      </details>}
      <TarefasGestao tarefas={agenda.data.tarefas} token={token} modo={secretario ? "SECRETARIA" : "PROJETOS"} podeEditar={podeEditar} usuarioId={session?.user?.id || ""} administrador={session?.user?.role === "admin"} responsaveis={responsaveis.data} />
    </div>
  );
}
