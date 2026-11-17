import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PrefeitoProjetos } from "./prefeito-projetos";

test("aba de projetos mostra todos os projetos e deixa filtros como opção adicional", () => {
  const html = renderToStaticMarkup(<PrefeitoProjetos projetos={[{
    id: "projeto-1", codigo: "P-01", nome: "Alça Viária", secretaria: "Obras",
    ciclo: "EM_ACOMPANHAMENTO", estruturante: true, totalTarefas: 5,
    concluidas: 2, atrasadas: 1, pendencias: 1, atualizadoEm: "2026-11-17T00:00:00.000Z",
  }]} />);
  assert.match(html, /Projetos do governo/);
  assert.match(html, /Alça Viária/);
  assert.match(html, /2 de 5/);
  assert.match(html, /href="\/iniciativas\/projeto-1"/);
  assert.match(html, /<details class="filterPanel prefeito-projects__filters"><summary/);
});

test("aba de projetos explica quando ainda não há cadastros", () => {
  const html = renderToStaticMarkup(<PrefeitoProjetos projetos={[]} />);
  assert.match(html, /Ainda não há projetos cadastrados neste município/);
});
