import assert from "node:assert/strict";
import { test } from "node:test";
import type { EscopoNo } from "./escopo-editor";
import { mesclarEscopo } from "./mesclar-escopo";

test("preserva indicador e alvo editados ao recalcular a prévia", () => {
  const modelo: EscopoNo = { codigo: "M1", nivel: "META", nome: "Meta modelo", indicador: "Original", alvo: "10", children: [] };
  const editada: EscopoNo = { ...modelo, nome: "Meta editada", indicador: "Unidades entregues", alvo: "20" };
  const manual: EscopoNo = { codigo: "M2", nivel: "META", nome: "Meta manual", manual: true, children: [] };
  assert.deepEqual(mesclarEscopo([editada, manual], [modelo]), [
    { ...editada, responsavel: undefined, prazo: undefined },
    manual,
  ]);
});

test("não restaura indicador e alvo removidos explicitamente", () => {
  const modelo: EscopoNo = { codigo: "M1", nivel: "META", nome: "Meta", indicador: "Original", alvo: "10", children: [] };
  assert.deepEqual(mesclarEscopo([{ ...modelo, indicador: "", alvo: "" }], [modelo])[0], {
    ...modelo, indicador: "", alvo: "", responsavel: undefined, prazo: undefined,
  });
});
