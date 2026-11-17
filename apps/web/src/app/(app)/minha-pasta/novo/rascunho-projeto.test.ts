import assert from "node:assert/strict";
import { test } from "node:test";
import { chaveRascunho, lerRascunho, salvarRascunho, type RascunhoProjeto } from "./rascunho-projeto";

const dados: RascunhoProjeto = {
  step: 4, secretariaId: "secretaria-1", responsavelPessoaId: "__novo__",
  novoNome: "Responsavel", novoCargo: "Gestor", novoTelefone: "123", novoEmail: "demo@example.test",
  nome: "Projeto rascunho", codigo: "TESTE", descricao: "Problema", entrega: "Entrega",
  foraEscopo: "Limites", beneficiariosTxt: "Comunidade", metaId: "__nova__",
  novaMetaNome: "Meta", planoId: "__novo__", novoPlanoNome: "Plano",
  ultimoPassoGerado: "Providencia", secretariasCorrelatas: ["secretaria-2"],
  respostas: {
    licenca: "Sim",
    orcamento_recursos: { codigo: "orcamento_recursos", aplicabilidade: "sim", situacao: "pendente", detalhes: { valor_verba: 1200 } },
  },
  escopo: [{ codigo: "MANUAL-1", nivel: "TAREFA", nome: "Minha tarefa", manual: true, responsavel: "Pessoa", prazo: "2026-12-01",
    children: [{ codigo: "MANUAL-2", nivel: "SUBTAREFA", nome: "Minha subtarefa", children: [] }] }],
};

function memoria() {
  const itens = new Map<string, string>();
  return {
    getItem: (chave: string) => itens.get(chave) ?? null,
    setItem: (chave: string, valor: string) => { itens.set(chave, valor); },
    removeItem: (chave: string) => { itens.delete(chave); },
  };
}

test("recupera todo o progresso, respostas e tarefas manuais sem persistir credenciais", () => {
  const storage = memoria();
  const chave = chaveRascunho("usuario", "municipio", "ESTRUTURANTE");
  assert.equal(lerRascunho(storage, chave), null);
  const dadosComToken = { ...dados, token: "NAO-PERSISTIR" };
  salvarRascunho(storage, chave, dadosComToken);
  assert.deepEqual(lerRascunho(storage, chave), dados);
  assert.doesNotMatch(storage.getItem(chave) || "", /NAO-PERSISTIR|token/);
  storage.removeItem(chave);
  assert.equal(lerRascunho(storage, chave), null);
});

test("isola usuário, prefeitura e categoria, inclusive com separadores nos ids", () => {
  const storage = memoria();
  const chave = chaveRascunho("a", "b", "ESTRUTURANTE");
  salvarRascunho(storage, chave, dados);
  for (const outro of [chaveRascunho("c", "b", "ESTRUTURANTE"), chaveRascunho("a", "c", "ESTRUTURANTE"), chaveRascunho("a", "b", "PRIORITARIO")]) {
    assert.equal(lerRascunho(storage, outro), null);
  }
  assert.notEqual(chaveRascunho("a:b", "c", "d"), chaveRascunho("a", "b:c", "d"));
  assert.throws(() => chaveRascunho("", "b", "c"), /incompleto/);
});

test("rascunhos inválidos, incompatíveis e falhas de armazenamento não são mascarados", () => {
  const storage = memoria();
  for (const registro of [
    "{", JSON.stringify({ versao: 2, dados }), JSON.stringify({ versao: 1, dados: { nome: "incompleto" } }),
    ...[
      { step: -1 }, { step: 1.5 }, { respostas: { item: { aplicabilidade: "sim" } } },
      { escopo: [{ codigo: "x", nivel: "INVALIDO", nome: "x", children: [] }] },
    ].map((patch) => JSON.stringify({ versao: 1, dados: { ...dados, ...patch } })),
  ]) {
    storage.setItem("chave", registro);
    assert.throws(() => lerRascunho(storage, "chave"));
    assert.equal(storage.getItem("chave"), registro);
  }
  assert.throws(() => salvarRascunho({ setItem() { throw new Error("QuotaExceededError"); } }, "chave", dados), /QuotaExceededError/);
  assert.throws(() => lerRascunho({ getItem() { throw new Error("SecurityError"); } }, "chave"), /SecurityError/);
});
