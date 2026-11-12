import { getServerSession } from "next-auth";
import { PageHeader } from "@cip/ui";
import { authOptions } from "@/lib/auth";
import { NotificacoesLista } from "./notificacoes-lista";

export default async function NotificacoesPage() {
  const session = await getServerSession(authOptions);
  return (
    <div className="stack">
      <PageHeader
        eyebrow="Avisos"
        title="Central de notificações"
        description="Tarefas atribuídas a você, evidências para validar, decisões da consultoria e prazos alterados — tudo em um só lugar."
      />
      <NotificacoesLista token={session?.accessToken || ""} />
    </div>
  );
}
