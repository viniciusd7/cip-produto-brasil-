import assert from "node:assert/strict";
import { test } from "node:test";
import type { EscopoNo } from "./escopo-editor";
import { mesclarEscopo } from "./mesclar-escopo";
import { normalizarEscopo } from "./normalizar-escopo";

test("preserva edições e tarefas manuais ao recalcular a prévia", () => {
  const modelo: EscopoNo = { codigo: "T1", nivel: "TAREFA", nome: "Tarefa modelo", children: [] };
  const editada: EscopoNo = { ...modelo, nome: "Tarefa editada", responsavel: "Equipe", prazo: "2026-12-10T12:00:00Z" };
  const manual: EscopoNo = { codigo: "T2", nivel: "TAREFA", nome: "Tarefa manual", manual: true, children: [] };
  assert.deepEqual(mesclarEscopo([editada, manual], [modelo]), [editada, manual]);
});

test("normaliza modelos legados e diretos em tarefas com subtarefas", () => {
  const nos = normalizarEscopo([
    { codigo: "M", nivel: "META", nome: "Legado", children: [
      { codigo: "T1", nivel: "TAREFA", nome: "Primeira", prazo: "2026-12-10", children: [
        { codigo: "S1", nivel: "SUBTAREFA", nome: "Passo", responsavel: "Equipe" },
      ] },
    ] },
    { codigo: "T2", nivel: "TAREFA", nome: "Segunda" },
  ]);
  assert.deepEqual(nos.map((n) => n.codigo), ["T1", "T2"]);
  assert.equal(nos[0].prazo, "2026-12-10");
  assert.equal(nos[0].children[0].responsavel, "Equipe");
  assert.equal(nos[0].children[0].nivel, "SUBTAREFA");
});
