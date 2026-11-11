import { getServerSession } from "next-auth";
import { PageHeader } from "@cip/ui";
import { authOptions } from "@/lib/auth";
import { NotificacoesLista } from "./notificacoes-lista";

export default async function NotificacoesPage() {
  const session = await getServerSession(authOptions);
  return (
    <div className="stack">
      <PageHeader
        eyebrow="Central de notificações"
        title="O que precisa da sua atenção"
        description="Atribuições de metas e tarefas, pedidos de validação, reprogramações e decisões da consultoria. Os envios por e-mail e WhatsApp usarão esta mesma fila."
      />
      <NotificacoesLista token={session?.accessToken || ""} />
    </div>
  );
}
