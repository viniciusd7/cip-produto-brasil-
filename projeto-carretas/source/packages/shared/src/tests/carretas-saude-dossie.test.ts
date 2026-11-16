import assert from "node:assert/strict";
import test from "node:test";
import {
  CARRETAS_ETAPAS,
  CARRETAS_FICHA_CAMPOS,
  CARRETAS_GATES,
  CARRETAS_INDICADORES,
  CARRETAS_ORCAMENTO,
  CARRETAS_POPS,
  CARRETAS_PRESTACAO,
  CARRETAS_RISCOS,
  criarCarretasDossiePadrao,
} from "./catalog/carretas-saude-dossie";

test("dossiê padrão contempla todos os artefatos da referência", () => {
  const dossie = criarCarretasDossiePadrao();

  assert.equal(CARRETAS_GATES.length, 5);
  assert.equal(CARRETAS_ETAPAS.length, 7);
  assert.equal(CARRETAS_ORCAMENTO.length, 7);
  assert.equal(CARRETAS_RISCOS.length, 12);
  assert.equal(CARRETAS_POPS.length, 8);
  assert.equal(CARRETAS_PRESTACAO.length, 8);
  assert.equal(CARRETAS_INDICADORES.length, 16);
  assert.equal(Object.keys(dossie.ficha).length, CARRETAS_FICHA_CAMPOS.length);
  assert.equal(dossie.gates.reduce((count, gate) => count + gate.criterios.length, 0), 22);
});

test("dossiê não presume informação, meta, custo ou autorização municipal", () => {
  const dossie = criarCarretasDossiePadrao();

  assert.equal(dossie.statusDemonstracao, "EM_VALIDACAO_CLIENTE");
  assert.ok(Object.values(dossie.ficha).every((value) => value === ""));
  assert.ok(dossie.orcamento.every((item) => item.valor === "" && item.fonteRecurso === ""));
  assert.ok(dossie.indicadores.every((item) => item.meta === "" && item.linhaBase === ""));
  assert.ok(dossie.gates.every((gate) => gate.situacao === "PENDENTE"));
  assert.ok(dossie.gates.every((gate) => gate.decisao === "" && gate.dataDecisao === ""));
  assert.ok(dossie.pops.every((pop) => pop.situacao === "PENDENTE"));
  assert.equal(dossie.decisaoPiloto.resultado, "");
});
