import assert from "node:assert/strict";
import test from "node:test";
import { relacaoCriariaCiclo } from "./relacoes-iniciativa";

test("dependência direta ou transitiva que fecha ciclo é rejeitada", () => {
  const dependencias = [
    { origemIniciativaId: "a", destinoIniciativaId: "b" },
    { origemIniciativaId: "b", destinoIniciativaId: "c" },
  ];

  assert.equal(relacaoCriariaCiclo(dependencias, "c", "a"), true);
  assert.equal(relacaoCriariaCiclo(dependencias, "c", "b"), true);
});

test("dependência sem caminho de retorno não cria ciclo", () => {
  const dependencias = [
    { origemIniciativaId: "a", destinoIniciativaId: "b" },
    { origemIniciativaId: "c", destinoIniciativaId: "d" },
  ];

  assert.equal(relacaoCriariaCiclo(dependencias, "b", "c"), false);
  assert.equal(relacaoCriariaCiclo([], "a", "a"), true);
});
