import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ProjetoPastas } from "../app/(app)/iniciativas/[id]/projeto-pastas";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
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
      token="token" iniciativaId="projeto" secretariaId="secretaria"
      permiteMetaPlano={false} onVerEvidencias={() => {}}
    />,
  );
  assert.match(html, /Tarefa direta/);
  assert.match(html, /Tarefa legada/);
  assert.match(html, /1 subtarefas/);
  assert.doesNotMatch(html, /meta de execução/i);
  assert.doesNotMatch(html, /Cadastro do projeto/);
});

test("cadastro do projeto fica junto aos filtros e tarefas existentes", () => {
  const tarefa: ProjetoDocMarco = {
    id: "t1", descricao: "Publicar edital", prazoStatus: "VENCIDO", responsavelUserId: "outra-pessoa",
    subtarefas: [], reprogramacoes: [],
  };
  const router = { bfcacheId: "teste", back() {}, forward() {}, refresh() {}, hmrRefresh() {}, push() {}, replace() {}, prefetch() {} };
  const html = renderToStaticMarkup(<AppRouterContext.Provider value={router}>
    <ProjetoPastas marcos={[tarefa]} evidencias={[]} aguardando={[]}
      canWrite canSubmitEvidence token="token" iniciativaId="projeto" secretariaId="secretaria"
      permiteMetaPlano={false} onVerEvidencias={() => {}}
      responsaveis={[{ id: "u1", name: "Ana" }]} usuarioId="u1" />
  </AppRouterContext.Provider>);
  assert.match(html, /Filtrar tarefas/);
  assert.match(html, /Nova tarefa/);
  assert.match(html, /Publicar edital/);
  assert.match(html, /Adicionar subtarefa à tarefa Publicar edital/);
  assert.doesNotMatch(html, /Cadastro do projeto|Tarefas e subtarefas/);
  assert.ok(html.indexOf("Nova tarefa") < html.indexOf("Publicar edital"));
});
