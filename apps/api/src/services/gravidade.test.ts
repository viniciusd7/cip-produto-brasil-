import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { avaliarSecretaria, classificarSecretaria, indicePonderado } from "./gravidade";

const base = {
  diasSemAtualizacao: 0,
  pctAtrasoAbertas: 0,
  indicePonderado: 0,
  pctSemPrazoAbertas: 0,
};

describe("classificação explicada das secretarias", () => {
  it("explica intervenção por percentual mesmo com índice abaixo do limite (Cultura)", () => {
    const resultado = avaliarSecretaria({ ...base, pctAtrasoAbertas: 50, indicePonderado: 25 });
    assert.equal(resultado.classificacao, "INTERVENCAO");
    assert.equal(resultado.motivos.length, 1);
    assert.match(resultado.motivos[0], /50%.*atrasadas.*50%/);
  });

  it("explica intervenção pelo índice mesmo com percentual abaixo do limite (Educação)", () => {
    const resultado = avaliarSecretaria({ ...base, pctAtrasoAbertas: 44.4, indicePonderado: 44.4 });
    assert.equal(resultado.classificacao, "INTERVENCAO");
    assert.equal(resultado.motivos.length, 1);
    assert.match(resultado.motivos[0], /Índice.*44,4%.*35%/);
  });

  it("mostra os dois motivos quando ambos os limites são atingidos", () => {
    const indice = indicePonderado([{ gravidade: "GRAVE" }], 2);
    assert.equal(indice, 37.5);
    const resultado = avaliarSecretaria({ ...base, pctAtrasoAbertas: 50, indicePonderado: indice });
    assert.equal(resultado.motivos.length, 2);
  });

  it("explica acompanhamento por tarefas sem prazo mesmo sem atrasos", () => {
    const resultado = avaliarSecretaria({ ...base, pctSemPrazoAbertas: 25 });
    assert.equal(resultado.classificacao, "ACOMPANHAMENTO");
    assert.match(resultado.motivos[0], /25%.*sem prazo/);
  });

  it("mantém a defasagem como prioridade acima de intervenção", () => {
    const resultado = avaliarSecretaria({ ...base, diasSemAtualizacao: 31, pctAtrasoAbertas: 100 });
    assert.equal(resultado.classificacao, "DADOS_DEFASADOS");
    assert.equal(resultado.motivos.length, 1);
    assert.match(resultado.motivos[0], /31 dias.*30 dias/);
  });

  it("preserva os limites e a precedência anteriores em todas as combinações", () => {
    for (const dias of [null, 0, 30, 31]) {
      for (const atraso of [0, 34.9, 35, 49.9, 50, 100]) {
        for (const indice of [0, 34.9, 35, 100]) {
          for (const semPrazo of [0, 24.9, 25, 100]) {
            const esperado = dias != null && dias > 30 ? "DADOS_DEFASADOS"
              : atraso >= 50 || indice >= 35 ? "INTERVENCAO"
              : atraso >= 35 || semPrazo >= 25 ? "ACOMPANHAMENTO" : "ROTINA";
            const params = { diasSemAtualizacao: dias, pctAtrasoAbertas: atraso, indicePonderado: indice, pctSemPrazoAbertas: semPrazo };
            assert.equal(avaliarSecretaria(params).classificacao, esperado);
            assert.equal(classificarSecretaria(params), esperado);
          }
        }
      }
    }
  });
});
