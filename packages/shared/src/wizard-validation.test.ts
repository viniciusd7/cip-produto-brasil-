import assert from "node:assert/strict";
import { test } from "node:test";
import { MODELO_ESTRUTURANTE } from "./catalog/estruturante";
import { MODELO_ACAO_DIARIA } from "./catalog/acao-diaria";
import { MODELO_PLANO_GOVERNO } from "./catalog/plano-governo";
import { adicionarImpedimentosComuns } from "./catalog/impedimentos-comuns";
import { validarNumerosDoWizard } from "./wizard-validation";

for (const [fluxo, original] of [["ESTRUTURANTE", MODELO_ESTRUTURANTE], ["PRIORITARIO", MODELO_ESTRUTURANTE], ["PLANO_GOVERNO", MODELO_PLANO_GOVERNO], ["ACAO_DIARIA", MODELO_ACAO_DIARIA]] as const) {
  const modelo = adicionarImpedimentosComuns(original);
  test(`${fluxo}: valores financeiros opcionais aceitam zero, centavos e ausência; rejeitam negativos e texto`, () => {
    const resposta = (valor: unknown) => [{ perguntaCodigo: "orcamento_recursos", valor: { codigo: "orcamento_recursos", aplicabilidade: "sim", situacao: "pendente", detalhes: { valor_verba: valor } } }];
    for (const valor of [undefined, null, "", "0", "1250000.50", "100,50"]) {
      assert.equal(validarNumerosDoWizard(modelo, resposta(valor)), null);
    }
    for (const valor of ["-1", -0.01, "abc", "Infinity", true, {}]) {
      assert.match(validarNumerosDoWizard(modelo, resposta(valor)) || "", /Valor previsto.*maior ou igual a zero/);
    }
  });
}

test("valor antigo em campo oculto não impede o cadastro depois de marcar não se aplica", () => {
  const modelo = adicionarImpedimentosComuns(MODELO_ESTRUTURANTE);
  assert.equal(validarNumerosDoWizard(modelo, [{ perguntaCodigo: "orcamento_recursos", valor: { codigo: "orcamento_recursos", aplicabilidade: "nao", situacao: "dispensada_com_fundamento", detalhes: { valor_verba: "-1" } } }]), null);
});

test("quantidades e dias exigem inteiros sem impedir informações ainda desconhecidas", () => {
  const modelo = { codigo: "QA", nome: "QA", perguntas: [{ codigo: "pessoas", texto: "Pessoas atendidas", tipoResposta: "NUMERO", impacto: "INFORMATIVA", ordem: 1 }], estrutura: [] } as const;
  for (const valor of [undefined, null, "", "0", 20]) assert.equal(validarNumerosDoWizard({ ...modelo, perguntas: [...modelo.perguntas], estrutura: [] }, [{ perguntaCodigo: "pessoas", valor: valor ?? null }]), null);
  for (const valor of [-1, "2.5", "abc"]) assert.match(validarNumerosDoWizard({ ...modelo, perguntas: [...modelo.perguntas], estrutura: [] }, [{ perguntaCodigo: "pessoas", valor }]) || "", /número inteiro/);
});
