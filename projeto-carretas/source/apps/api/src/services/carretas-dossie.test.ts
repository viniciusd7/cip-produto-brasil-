import assert from "node:assert/strict";
import test from "node:test";
import { criarCarretasDossiePadrao, type CarretasDossie } from "@cip/shared";
import { salvarCarretasDossieSchema } from "./carretas-dossie";

test("aceita o dossiê piloto completo sem dados municipais inventados", () => {
  const parsed = salvarCarretasDossieSchema.safeParse({
    revision: 0,
    dossie: criarCarretasDossiePadrao(),
  });

  assert.equal(parsed.success, true);
});

test("rejeita portão ou registro fora do catálogo aprovado", () => {
  const dossie = criarCarretasDossiePadrao();
  const invalid = JSON.parse(JSON.stringify(dossie)) as CarretasDossie;
  invalid.gates[0]!.codigo = "G9";

  const parsed = salvarCarretasDossieSchema.safeParse({ revision: 0, dossie: invalid });
  assert.equal(parsed.success, false);
});

test("rejeita valores orçamentários negativos e datas inválidas", () => {
  const invalidCost = criarCarretasDossiePadrao();
  invalidCost.orcamento[0]!.valor = "-20";
  assert.equal(
    salvarCarretasDossieSchema.safeParse({ revision: 0, dossie: invalidCost }).success,
    false,
  );

  const invalidDate = criarCarretasDossiePadrao();
  invalidDate.ficha.dataD0 = "2026-02-31";
  assert.equal(
    salvarCarretasDossieSchema.safeParse({ revision: 0, dossie: invalidDate }).success,
    false,
  );
});

test("não permite confirmar custo, medição ou risco sem comprovação", () => {
  const invalidCost: CarretasDossie = criarCarretasDossiePadrao();
  invalidCost.orcamento[0]!.situacao = "VALIDADO";
  assert.equal(
    salvarCarretasDossieSchema.safeParse({ revision: 0, dossie: invalidCost }).success,
    false,
  );

  const invalidMetric: CarretasDossie = criarCarretasDossiePadrao();
  invalidMetric.indicadores[0]!.meta = "25";
  assert.equal(
    salvarCarretasDossieSchema.safeParse({ revision: 0, dossie: invalidMetric }).success,
    false,
  );

  const invalidRisk: CarretasDossie = criarCarretasDossiePadrao();
  invalidRisk.riscos[0]!.situacao = "ACONTECEU";
  assert.equal(
    salvarCarretasDossieSchema.safeParse({ revision: 0, dossie: invalidRisk }).success,
    false,
  );
});

test("exige justificativa, autoridade e data para decisão final do piloto", () => {
  const dossie: CarretasDossie = criarCarretasDossiePadrao();
  dossie.decisaoPiloto.resultado = "ESCALAR_COM_CONDICOES";

  assert.equal(
    salvarCarretasDossieSchema.safeParse({ revision: 0, dossie }).success,
    false,
  );
});
