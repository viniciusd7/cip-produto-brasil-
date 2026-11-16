import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { TabelaRelatorio, type ConsultaRelatorio } from "../app/(app)/relatorios/tabela-relatorio";
import { FiltrosPrestacao } from "../app/(app)/relatorios/filtros-prestacao";
import { ExportButtons } from "../app/(app)/relatorios/export-buttons";
import { getNavForRole } from "../lib/roles";
import RelatorioErro from "../app/(app)/relatorios/error";

test("tabela plana renderiza todas as linhas recebidas e mantém filtros na ordenação", () => {
  const consulta: ConsultaRelatorio = {
    tipo: "tarefas", busca: "João", ordenar: "codigo", direcao: "asc", total: 605,
    colunas: [{ chave: "codigo", rotulo: "Código" }, { chave: "tarefa", rotulo: "Tarefa" }],
    linhas: Array.from({ length: 605 }, (_, i) => ({ id: `t-${i}`, valores: { codigo: `T-${i}`, tarefa: `Tarefa histórica ${i}` } })),
  };
  const html = renderToStaticMarkup(<TabelaRelatorio consulta={consulta}
    parametros="tipo=tarefas&busca=Jo%C3%A3o&secretariaId=sec&status=VENCIDO&ordenar=codigo&direcao=asc" />);
  assert.equal((html.match(/<tr>/g) ?? []).length, 606);
  assert.match(html, /Tarefa histórica 604/);
  assert.match(html, /aria-sort="ascending"/);
  assert.match(html, /busca=Jo%C3%A3o/);
  assert.match(html, /secretariaId=sec/);
  assert.match(html, /status=VENCIDO/);
  assert.match(html, /ordenar=codigo&amp;direcao=desc/);
  assert.doesNotMatch(html, /Mostrar mais|<details|treeitem/);
});

test("consulta vazia tem explicação e exportação continua disponível", () => {
  const html = renderToStaticMarkup(<TabelaRelatorio parametros="" consulta={{
    tipo: "tarefas", busca: "", ordenar: "codigo", direcao: "asc", total: 0, colunas: [], linhas: [],
  }} />);
  assert.match(html, /Nenhum resultado/);
  const botoes = renderToStaticMarkup(<ExportButtons csv="Código;Tarefa" />);
  assert.match(botoes, /Exportar esta tabela \(CSV\)/);
});

test("filtros aplicados por formulário único e metas não herdam situação de tarefas", () => {
  const html = renderToStaticMarkup(<FiltrosPrestacao opcoes={{ secretarias: [], projetos: [], mandato: null }}
    filtros={{ tipo: "metas", busca: "Cobertura", ordenar: "indicador", direcao: "desc" }} />);
  assert.match(html, /action="\/relatorios"/);
  assert.match(html, /method="get"/);
  assert.match(html, /name="busca"/);
  assert.match(html, /value="Cobertura"/);
  assert.match(html, /name="ordenar" value="indicador"/);
  assert.match(html, /Aplicar filtros e busca/);
  assert.doesNotMatch(html, /name="status"/);
});

test("menu mantém os acessos existentes a relatórios sem ramificação", () => {
  for (const role of ["admin", "prefeito", "analista", "leitura"]) {
    const item = getNavForRole(role).find((nav) => nav.href === "/relatorios");
    assert.ok(item, role);
    assert.ok(!item.children?.length, role);
  }
  assert.ok(!getNavForRole("gestor").some((nav) => nav.href === "/relatorios"));
});

test("falha da consulta é explícita, acessível e permite recuperação sem oferecer CSV", () => {
  const html = renderToStaticMarkup(<RelatorioErro reset={() => {}} />);
  assert.match(html, /aria-labelledby="relatorio-erro-titulo"/);
  assert.match(html, /role="alert"/);
  assert.match(html, /<button[^>]*>Tentar novamente<\/button>/);
  assert.match(html, /href="\/relatorios"/);
  assert.doesNotMatch(html, /Exportar esta tabela/);
});
