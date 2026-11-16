import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AjudaCampo, RotuloComAjuda } from "./ajuda-campo";
import { CondicaoCard } from "./condicao-card";
import { EscopoEditor } from "../app/(app)/minha-pasta/novo/escopo-editor";

test("a ajuda tem identificação acessível e não envolve o campo no controle interativo", () => {
  const html = renderToStaticMarkup(
    <RotuloComAjuda htmlFor="nome" campo="Nome" ajuda="Informe um nome." />,
  );
  assert.match(html, /<label for="nome">Nome<\/label>/);
  assert.match(html, /<summary aria-label="Ajuda sobre Nome">\?<\/summary>/);
  assert.match(html, /Informe um nome\./);
  assert.match(renderToStaticMarkup(<AjudaCampo campo="Prazo">Escolha a data.</AjudaCampo>), /Escolha a data/);
});

test("a ajuda contempla campos de metas, tarefas e subtarefas", () => {
  const html = renderToStaticMarkup(
    <EscopoEditor
      nodes={[{ codigo: "m", nivel: "META", nome: "Meta", children: [
        { codigo: "t", nivel: "TAREFA", nome: "Tarefa", children: [
          { codigo: "s", nivel: "SUBTAREFA", nome: "Subtarefa", children: [] },
        ] },
      ] }]}
      onChange={() => {}}
      equipe={[]}
      listId="equipe"
    />,
  );
  for (const campo of ["O que precisa ser entregue", "Responsável pela meta", "Indicador da meta", "Resultado esperado", "Tarefa", "Prazo", "Subtarefa"]) {
    assert.ok(html.includes(`aria-label="Ajuda sobre ${campo}"`), campo);
  }
  assert.equal((html.match(/aria-label="Ajuda sobre Quem faz\?"/g) || []).length, 2);
});

test("ajuda das condições inclui situação e detalhes sem alterar outras telas", () => {
  const props = {
    pergunta: {
      codigo: "LICITACAO",
      texto: "Precisa de licitação?",
      rotulo: "Licitação",
      tipoResposta: "CONDICAO_FECHADA" as const,
      impacto: "BLOQUEANTE" as const,
      ordem: 1,
      metadados: { impedimento: true },
      camposFollowUp: [{ chave: "objeto", label: "Objeto", tipo: "texto" as const, ajuda: "Informe o objeto." }],
    },
    valor: { codigo: "LICITACAO", aplicabilidade: "sim" as const, situacao: "pendente" as const },
    onChange: () => {},
  };
  const html = renderToStaticMarkup(<CondicaoCard {...props} mostrarAjuda />);
  for (const campo of ["Licitação", "Situação do item", "Fundamento", "Próxima providência", "Quem acompanha", "Objeto"]) {
    assert.ok(html.includes(`aria-label="Ajuda sobre ${campo}"`), campo);
  }
  assert.ok(html.includes("Informe o objeto."));
  assert.doesNotMatch(renderToStaticMarkup(<CondicaoCard {...props} />), /ajuda-campo/);
});
