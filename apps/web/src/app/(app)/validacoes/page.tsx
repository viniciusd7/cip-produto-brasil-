import { getServerSession } from "next-auth";
import { PageHeader } from "@cip/ui";
import { authOptions } from "@/lib/auth";
import { canValidateRole } from "@/lib/roles";
import { ValidacoesFila } from "./validacoes-fila";

export default async function ValidacoesPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  return (
    <div className="stack">
      <PageHeader
        eyebrow="Validação da consultoria"
        title="Conclusões aguardando validação"
        description="O secretário informa a conclusão da tarefa com justificativa e evidência (documento, foto ou vídeo). A consultoria aprova — e a tarefa é concluída — ou devolve com parecer."
      />
      <ValidacoesFila token={session?.accessToken || ""} podeDecidir={canValidateRole(role)} />
    </div>
  );
}
