import { getServerSession } from "next-auth";
import { PageHeader } from "@cip/ui";
import { authOptions } from "@/lib/auth";
import { canUploadKnowledgeRole, canValidateRole } from "@/lib/roles";
import { ConhecimentoForm } from "../planejamento/conhecimento-form";

export default async function BaseConhecimentoPage() {
  const session = await getServerSession(authOptions);
  return (
    <div className="stack">
      <PageHeader
        eyebrow="Documentos da prefeitura"
        title="Base de conhecimento"
        description="O Plano de Governo é obrigatório; PPA, LDO, LOA, diagnóstico e outros documentos são opcionais."
      />
      <ConhecimentoForm
        token={session?.accessToken || ""}
        metas={[]}
        somenteDocumentos
        podeAnexar={canUploadKnowledgeRole(session?.user?.role)}
        podeConferir={canValidateRole(session?.user?.role)}
      />
    </div>
  );
}
