import assert from "node:assert/strict";
import test from "node:test";
import { campoCsv, consultaRelatorioSchema, consultarRelatorio, exportarConsultaCsv } from "./relatorio-consulta";

function fixture(): Parameters<typeof consultarRelatorio>[0] {
  return {
    tarefas: [
      { id: "legada", codigo: "T-1", descricao: "Revisão; histórica\ncom \"evidência\"", responsavel: "João",
        secretaria: "Saúde", projetoCodigo: "P-1", projetoNome: "Atendimento", status: "VENCIDO",
        prazo: "2026-02-01T00:00:00Z", prazoOriginal: null, concluidoEm: null,
        reprogramacoes: 10, subtarefas: { feitas: 1, total: 3 }, evidencias: { total: 2, aprovadas: 1 } },
      { id: "direta", codigo: "T-2", descricao: "Atendimento direto", responsavel: "Ana",
        secretaria: "Saúde", projetoCodigo: "P-1", projetoNome: "Atendimento", status: "SEM_PRAZO",
        prazo: null, prazoOriginal: null, concluidoEm: null,
        reprogramacoes: 2, subtarefas: { feitas: 0, total: 0 }, evidencias: { total: 0, aprovadas: 0 } },
    ],
    metasEstrategicas: [
      { id: "meta", nome: "Ampliar atendimento", secretaria: "Saúde", base: null, realizado: null, alvo: null, unidade: null, dataCorte: null,
        projetos: [{ codigo: "P-1", nome: "Atendimento" }, { codigo: "P-2", nome: "Hospital" }],
        indicadores: [{ id: "ind", nome: "Cobertura", unidade: "%", valorBase: "20", valorAtual: "35", alvo: "80", periodicidade: "MENSAL",
          medicao: { valorRealizado: "32", dataCorte: "2026-11-16T00:00:00Z" } }] },
      { id: "sem-indicador", nome: "Meta sem indicador", secretaria: null, base: "0", realizado: null, alvo: "10", unidade: "pessoas",
        dataCorte: null, projetos: [], indicadores: [] },
    ],
    projetos: [{ id: "p", codigo: "P-1", nome: "Atendimento", secretaria: "Saúde", total: 2, concluidas: 0, noPrazo: 0, semPrazo: 1, atrasadas: 1 }],
    porSecretaria: [{ id: "s", nome: "Saúde", sigla: "SMS", projetos: 1, total: 2, concluidas: 0, noPrazo: 0, semPrazo: 1, atrasadas: 1 }],
    evidenciasDetalhadas: [{ id: "ev", secretaria: "Saúde", projeto: "P-1 · Atendimento", tipo: "FOTO", status: "VERIFICADA", criadaEm: "2026-11-16T00:00:00Z" }],
  };
}

test("consulta busca em todas as colunas sem distinguir acentos e ordena numericamente", () => {
  const dados = fixture();
  const consulta = consultarRelatorio(dados, consultaRelatorioSchema.parse({ busca: "JOAO", ordenar: "reprogramacoes", direcao: "desc" }));
  assert.deepEqual(consulta.linhas.map((l) => l.id), ["legada"]);
  const ordenadas = consultarRelatorio(dados, consultaRelatorioSchema.parse({ ordenar: "reprogramacoes", direcao: "asc" }));
  assert.deepEqual(ordenadas.linhas.map((l) => l.id), ["direta", "legada"]);
  const datas = consultarRelatorio(dados, consultaRelatorioSchema.parse({ ordenar: "prazo", direcao: "desc" }));
  assert.deepEqual(datas.linhas.map((l) => l.id), ["legada", "direta"]);
});

test("todos os tipos exportam exatamente colunas e linhas da consulta ordenada", () => {
  for (const tipo of ["tarefas", "metas", "projetos", "secretarias", "evidencias"]) {
    const consulta = consultarRelatorio(fixture(), consultaRelatorioSchema.parse({ tipo }));
    const csv = exportarConsultaCsv(consulta);
    assert.ok(csv.startsWith("\uFEFF"));
    assert.equal(csv, "\uFEFF" + [
      consulta.colunas.map((c) => campoCsv(c.rotulo)).join(";"),
      ...consulta.linhas.map((l) => consulta.colunas.map((c) => campoCsv(l.valores[c.chave] ?? null)).join(";")),
    ].join("\r\n"));
    assert.equal(consulta.total, consulta.linhas.length);
  }
});

test("meta compartilhada não se multiplica por projeto, indicador real mantém valores", () => {
  const consulta = consultarRelatorio(fixture(), consultaRelatorioSchema.parse({ tipo: "metas" }));
  assert.equal(consulta.total, 2);
  const linha = consulta.linhas.find((l) => l.id === "meta:ind");
  assert.ok(linha);
  assert.equal(linha.valores.projetos, "P-1 · Atendimento; P-2 · Hospital");
  assert.equal(linha.valores.base, "20");
  assert.equal(linha.valores.atual, "35");
  assert.equal(linha.valores.alvo, "80");
  assert.equal(linha.valores.medicao, "32");
  assert.ok(!consulta.colunas.some((c) => c.chave === "pct"));
  assert.ok(consulta.linhas.some((l) => l.id === "sem-indicador"));
});

test("CSV trata separadores, aspas, CR/LF e fórmulas sem executar conteúdo", () => {
  assert.equal(campoCsv('A;"B"\r\nC'), '"A;""B""\r\nC"');
  assert.equal(campoCsv("=1+1"), "'=1+1");
  assert.equal(campoCsv("\t@SUM(A1)"), "'\t@SUM(A1)");
  assert.equal(campoCsv(-12), "-12");
  assert.equal(campoCsv(null), "");
});

test("consulta não limita 500 registros e rejeita coluna inválida", () => {
  const dados = fixture();
  dados.tarefas = Array.from({ length: 601 }, (_, i) => ({ ...dados.tarefas[0], id: `t-${i}` }));
  assert.equal(consultarRelatorio(dados, consultaRelatorioSchema.parse({})).total, 601);
  assert.throws(() => consultarRelatorio(dados, consultaRelatorioSchema.parse({ ordenar: "campo-inexistente" })), /Coluna de ordenação inválida/);
});

test("valores decimais estratégicos ordenam como números, sem alterar a apresentação", () => {
  const dados = fixture();
  dados.metasEstrategicas[0].indicadores[0].valorBase = "10.5";
  dados.metasEstrategicas[1].base = "10.20";
  const consulta = consultarRelatorio(dados, consultaRelatorioSchema.parse({ tipo: "metas", ordenar: "base" }));
  assert.deepEqual(consulta.linhas.map((l) => l.valores.base), ["10.20", "10.5"]);
});
