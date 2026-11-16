import assert from "node:assert/strict";
import test from "node:test";
import {
  GRUPOS_CARRETAS_SAUDE,
  MODELO_CARRETAS_SAUDE,
} from "./catalog/carretas-saude";

test("template Carretas da Saúde contém os cinco gates administrativos e etapas correspondentes", () => {
  assert.deepEqual(
    GRUPOS_CARRETAS_SAUDE.map((grupo) => grupo.id),
    ["g0", "g1", "g2", "g3", "g4"],
  );
  assert.deepEqual(
    MODELO_CARRETAS_SAUDE.etapas?.map((etapa) => etapa.codigo),
    ["G0", "G1", "G2", "G3", "G4"],
  );
  assert.equal(MODELO_CARRETAS_SAUDE.perguntas.length, 5);
  assert.equal(
    MODELO_CARRETAS_SAUDE.estrutura.filter((item) => item.nivel === "TAREFA").length,
    5,
  );
});

test("template mantém gates informativos e não pede dados clínicos ou identificadores de pacientes", () => {
  assert.ok(
    MODELO_CARRETAS_SAUDE.perguntas.every(
      (pergunta) => pergunta.impacto === "INFORMATIVA" && !pergunta.obrigatoria,
    ),
  );
  const conteudo = JSON.stringify(MODELO_CARRETAS_SAUDE).toLowerCase();
  for (const termoClinico of ["prontuário", "diagnóstico individual", "cpf do paciente"]) {
    assert.equal(conteudo.includes(termoClinico), false);
  }
});
