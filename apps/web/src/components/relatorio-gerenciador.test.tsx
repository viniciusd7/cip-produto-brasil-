import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { GerenciadorRelatorio, type DadosGerenciador } from "../app/(app)/relatorios/gerenciador-relatorio";
import type { ConsultaRelatorio } from "../app/(app)/relatorios/tabela-relatorio";

const dados: DadosGerenciador = {
  projetos: [
    { id: "p1", codigo: "P-01", nome: "Escola", secretaria: "Educação", total: 2, concluidas: 1, noPrazo: 0, semPrazo: 0, atrasadas: 1 },
    { id: "p2", codigo: "P-02", nome: "Praça", secretaria: "Obras", total: 1, concluidas: 0, noPrazo: 1, semPrazo: 0, atrasadas: 0 },
  ],
  tarefas: [
    { id: "t1", codigo: "T-01", descricao: "Concluir reforma", status: "VENCIDO", responsavel: "Equipe", prazo: "2026-11-10T00:00:00.000Z", projetoId: "p1", projetoCodigo: "P-01", projetoNome: "Escola", secretaria: "Educação", subtarefas: { total: 2, feitas: 1, itens: [
      { id: "s1", descricao: "Comprar materiais", concluida: true, prazo: null, responsavel: null },
      { id: "s2", descricao: "Instalar telhado", concluida: false, prazo: null, responsavel: "Obras" },
    ] } },
    { id: "t2", codigo: "T-02", descricao: "Pintura", status: "CONCLUIDO", responsavel: null, prazo: null, projetoId: "p1", projetoCodigo: "P-01", projetoNome: "Escola", secretaria: "Educação", subtarefas: { total: 0, feitas: 0, itens: [] } },
    { id: "t3", codigo: "T-03", descricao: "Abrir praça", status: "NO_PRAZO", responsavel: null, prazo: null, projetoId: "p2", projetoCodigo: "P-02", projetoNome: "Praça", secretaria: "Obras", subtarefas: { total: 0, feitas: 0, itens: [] } },
  ],
  metasEstrategicas: [{ id: "m1", nome: "Aprendizagem", secretaria: "Educação", indicadores: [{ id: "i1", nome: "Escolas reformadas", unidade: "%", valorBase: "0", valorAtual: "30", alvo: "100", medicao: { valorRealizado: "40", dataCorte: "2026-11-17T00:00:00.000Z" } }] }],
};

test("gerenciador mostra gráficos, progresso e cada subtarefa", () => {
  const consulta: ConsultaRelatorio = { tipo: "tarefas", busca: "", ordenar: "tarefa", direcao: "asc", total: 3, colunas: [], linhas: ["t1", "t2", "t3"].map((id) => ({ id, valores: {} })) };
  const html = renderToStaticMarkup(<GerenciadorRelatorio dados={dados} consulta={consulta} />);
  assert.match(html, /Situação das tarefas/);
  assert.match(html, /Progresso das subtarefas/);
  assert.match(html, /1 de 2[\s\S]*subtarefas concluídas/);
  assert.match(html, /Comprar materiais/);
  assert.match(html, /Instalar telhado/);
  assert.match(html, /Avanço entre base e alvo/);
  assert.match(html, /value="40" max="100"/);
  assert.match(html, /P-01 · Escola/);
  assert.match(html, /href="\/iniciativas\/p1\?aba=andamento"/);
});

test("busca da consulta limita tarefas e projetos do gerenciador", () => {
  const consulta: ConsultaRelatorio = { tipo: "tarefas", busca: "Escola", ordenar: "tarefa", direcao: "asc", total: 1, colunas: [], linhas: [{ id: "t1", valores: {} }] };
  const html = renderToStaticMarkup(<GerenciadorRelatorio dados={dados} consulta={consulta} />);
  assert.match(html, /Concluir reforma/);
  assert.doesNotMatch(html, /P-02 · Praça/);
  assert.doesNotMatch(html, /Pintura/);
  assert.match(html, /Busca textual e situação selecionam apenas tarefas/);
});
