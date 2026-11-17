import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { TarefasGestao, type TarefaGestaoItem } from "../app/(app)/minha-pasta/tarefas-gestao";

const router = { bfcacheId: "teste", back() {}, forward() {}, refresh() {}, hmrRefresh() {}, push() {}, replace() {}, prefetch() {} };
const tarefa: TarefaGestaoItem = {
  id: "t1", codigo: "T-01", descricao: "Reformar escola", status: "NO_PRAZO",
  responsavel: "Equipe de obras", prazo: "2026-12-01T12:00:00Z", meta: null,
  subtarefas: { total: 2, concluidas: 1 }, iniciativaId: "p1", iniciativaCodigo: "P-01",
  iniciativaNome: "Escola municipal", secretaria: "Secretaria de Educação",
};

test("gerenciador mostra tarefas reais, filtros, progresso e ações operacionais", () => {
  const html = renderToStaticMarkup(<AppRouterContext.Provider value={router}>
    <TarefasGestao tarefas={[tarefa]} token="segredo" modo="PROJETOS" podeEditar />
  </AppRouterContext.Provider>);
  assert.match(html, /Secretaria de Educação/);
  assert.match(html, /Reformar escola/);
  assert.match(html, /Escola municipal/);
  assert.match(html, /Equipe de obras/);
  assert.match(html, /Prazo mais próximo/);
  assert.match(html, /value="1" max="2"/);
  assert.match(html, /Concluir/);
  assert.doesNotMatch(html, /Enviar para validação|segredo/);
});

test("modo de consulta não oferece conclusão e projetos vazios têm orientação", () => {
  const html = renderToStaticMarkup(<AppRouterContext.Provider value={router}>
    <TarefasGestao tarefas={[]} token="segredo" modo="PROJETOS" />
  </AppRouterContext.Provider>);
  assert.match(html, /Ainda não há tarefas cadastradas/);
  assert.doesNotMatch(html, />Concluir</);
});
