import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ProjetoPastas } from "../app/(app)/iniciativas/[id]/projeto-pastas";
import type { ProjetoDocMarco } from "../app/(app)/iniciativas/[id]/projeto-documento";

test("exibe tarefas diretas e legadas juntas, sem edição no modo leitura", () => {
  const tarefa = (id: string, descricao: string, metaExecucaoId?: string): ProjetoDocMarco => ({
    id, descricao, metaExecucaoId, prazoStatus: "NO_PRAZO", prazoVigente: "2026-12-10T12:00:00Z",
    subtarefas: [{ id: `${id}-sub`, descricao: "Passo", concluida: false, prazo: "2026-12-10T12:00:00Z" }],
    reprogramacoes: [],
  });
  const html = renderToStaticMarkup(
    <ProjetoPastas
      marcos={[tarefa("direta", "Tarefa direta"), tarefa("legada", "Tarefa legada", "meta-antiga")]}
      evidencias={[]} aguardando={[]} canWrite={false} canSubmitEvidence={false}
      token="token" equipe={[]} iniciativaId="projeto" secretariaId="secretaria"
      permiteMetaPlano={false} onVerEvidencias={() => {}}
    />,
  );
  assert.match(html, /Tarefa direta/);
  assert.match(html, /Tarefa legada/);
  assert.match(html, /1 subtarefas/);
  assert.doesNotMatch(html, /meta de execução/i);
  assert.doesNotMatch(html, /Cadastro do projeto/);
});
