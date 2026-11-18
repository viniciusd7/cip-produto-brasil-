import assert from "node:assert/strict";
import { test } from "node:test";
import { prepararDocumento } from "./documento-upload";

test("preserva título e descrição informados, removendo espaços nas extremidades", () => {
  const form = new FormData();
  form.set("tipo", "AUTO");
  form.set("arquivo", new File(["teste"], "Plano plurianual.PDF", { type: "application/pdf" }));
  form.set("titulo", "  Planejamento municipal 2026  ");
  form.set("observacao", "  Apresenta prioridades e investimentos.  ");
  prepararDocumento(form);
  assert.equal(form.get("titulo"), "Planejamento municipal 2026");
  assert.equal(form.get("observacao"), "Apresenta prioridades e investimentos.");
  assert.equal(form.get("tipo"), "AUTO");
});

test("não permite envio sem arquivo", () => {
  assert.throws(() => prepararDocumento(new FormData()), /Selecione um arquivo/);
});

test("exige título e descrição mesmo com arquivo selecionado", () => {
  const form = new FormData();
  form.set("arquivo", new File(["teste"], "a.pdf", { type: "application/pdf" }));
  for (const titulo of ["", "  ", "ab"]) {
    form.set("titulo", titulo);
    assert.throws(() => prepararDocumento(form), /Informe um título/);
  }
  form.set("titulo", "Documento municipal");
  for (const descricao of ["", "  ", "ab"]) {
    form.set("observacao", descricao);
    assert.throws(() => prepararDocumento(form), /Descreva do que trata/);
  }
  form.set("observacao", "Relatório de necessidades da prefeitura.");
  assert.equal(prepararDocumento(form).get("titulo"), "Documento municipal");
});
