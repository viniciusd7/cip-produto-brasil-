import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { TarefasGestao, type TarefaGestaoItem } from "../app/(app)/minha-pasta/tarefas-gestao";
import { AcaoForm } from "../app/(app)/acoes/acao-form";

const router = { bfcacheId: "teste", back() {}, forward() {}, refresh() {}, hmrRefresh() {}, push() {}, replace() {}, prefetch() {} };
const tarefa: TarefaGestaoItem = {
  id: "t1", codigo: "T-01", descricao: "Reformar escola", status: "NO_PRAZO",
  responsavel: "Equipe de obras", prazo: "2026-12-01T12:00:00Z", meta: null,
  subtarefas: { total: 2, concluidas: 1, itens: [
    { id: "s1", descricao: "Levantar documentos", responsavel: "Ana", prazo: "2026-11-28T12:00:00Z", concluida: false },
    { id: "s2", descricao: "Conferir entrega", responsavel: "Bruno", prazo: "2026-12-01T12:00:00Z", concluida: true },
  ] }, iniciativaId: "p1", iniciativaCodigo: "P-01",
  iniciativaNome: "Escola municipal", secretaria: "Secretaria de Educação",
};

test("gerenciador mostra tarefas reais, filtros, progresso e ações operacionais", () => {
  const html = renderToStaticMarkup(<AppRouterContext.Provider value={router}>
    <TarefasGestao tarefas={[tarefa]} token="segredo" modo="PROJETOS" podeEditar usuarioId="u1" administrador responsaveis={[{ id: "u1", name: "Ana" }]} />
  </AppRouterContext.Provider>);
  assert.match(html, /Secretaria de Educação/);
  assert.match(html, /Reformar escola/);
  assert.match(html, /Escola municipal/);
  assert.match(html, /Equipe de obras/);
  assert.match(html, /Prazo mais próximo/);
  assert.match(html, /value="1" max="2"/);
  assert.match(html, /Levantar documentos/);
  assert.match(html, /Em aberto · Ana · Prazo: 28\/11\/2026/);
  assert.match(html, /Reprogramar prazo/);
  assert.match(html, /Atribuir responsável/);
  assert.match(html, /Concluir subtarefa/);
  assert.match(html, /Concluir/);
  assert.doesNotMatch(html, /Enviar para validação|segredo/);
});

test("cadastro de tarefa exige projeto, responsável e prazo", () => {
  const html = renderToStaticMarkup(<AppRouterContext.Provider value={router}>
    <AcaoForm token="segredo" iniciativas={[{ id: "p1", label: "P-01 · Escola municipal" }]}
      tarefas={[tarefa]} responsaveis={[{ id: "u1", name: "Ana", secretaria: { nome: "Educação" } }]}
      usuarioId="u1" administrador={false} />
  </AppRouterContext.Provider>);
  assert.match(html, /Criar tarefa ou subtarefa/);
  assert.match(html, /value="SUBTAREFA"/);
  assert.match(html, /name="iniciativaId"/);
  assert.match(html, /name="responsavelUserId"[^>]*required/);
  assert.match(html, /<input[^>]*required[^>]*name="prazo"/);
  assert.doesNotMatch(html, /segredo/);
});

test("modo de consulta não oferece conclusão e projetos vazios têm orientação", () => {
  const html = renderToStaticMarkup(<AppRouterContext.Provider value={router}>
    <TarefasGestao tarefas={[]} token="segredo" modo="PROJETOS" />
  </AppRouterContext.Provider>);
  assert.match(html, /Ainda não há tarefas cadastradas/);
  assert.doesNotMatch(html, />Concluir</);
});
