import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PrefeitoExecutiveFocus, PrefeitoExecutionGoals } from "./prefeito-overview";
import { overviewCopy, secretariaRecommendation } from "./audience";

const meta = {
  id: "meta-1", nome: "Mobilidade urbana", codigo: "ME-01", unidade: "%",
  resultadoChaveOkr: "Concluir a etapa prevista",
  projetosVinculados: [{ id: "projeto-1", codigo: "P-01", nome: "Alça Viária" }],
  indicadores: [{ id: "indicador-1", nome: "Trecho entregue", unidade: "%", valorAtual: "30", alvo: "100" }],
  medicaoAtual: { dataCorte: "2026-11-17T00:00:00.000Z", valorRealizado: "30", valorEsperado: "40", fonte: "Medição municipal" },
  medicaoAnterior: { dataCorte: "2026-10-17T00:00:00.000Z", valorRealizado: "20" },
  desvio: -10,
};

test("bloco executivo mostra medições e fonte sem misturar contagem operacional", () => {
  const html = renderToStaticMarkup(<PrefeitoExecutiveFocus metas={[meta]} dataReferencia="2026-11-17T00:00:00.000Z" />);
  assert.match(html, /Metas estratégicas e resultados/);
  assert.match(html, /Realizado informado<\/span><strong>30 %<\/strong>/);
  assert.match(html, /Esperado na data<\/span><strong>40 %<\/strong>/);
  assert.match(html, /Desvio numérico<\/span><strong>-10 %<\/strong>/);
  assert.match(html, /Medição anterior<\/span><strong>20 %<\/strong>/);
  assert.match(html, /Fonte informada: Medição municipal/);
  assert.match(html, /Projetos vinculados: P-01 · Alça Viária/);
  assert.doesNotMatch(html, /tarefas concluídas|Tarefas de execução|Próxima cobrança/);
});

test("meta sem medição fica pendente sem percentual presumido", () => {
  const html = renderToStaticMarkup(<PrefeitoExecutiveFocus metas={[{ ...meta, medicaoAtual: null, medicaoAnterior: null, desvio: null }]} />);
  assert.match(html, /Aguardando medição/);
  assert.match(html, /Desvio numérico<\/span><strong>Não calculável<\/strong>/);
});

test("prefeito vê metas de execução medidas agrupadas por projeto", () => {
  const html = renderToStaticMarkup(<PrefeitoExecutionGoals projetos={[{
    id: "projeto-1", codigo: "P-01", nome: "Alça Viária", metasExecucao: [{
      id: "exec-1", codigo: "MX-01", nome: "Entregar trecho", indicador: "Extensão pronta", unidade: "km",
      alvo: "10", valorAtual: "4", prazo: "2027-03-01T00:00:00.000Z",
      medicaoAtual: { dataCorte: "2026-11-17T00:00:00.000Z", valorRealizado: "4", valorEsperado: "5", fonte: "Obras" },
      medicaoAnterior: { dataCorte: "2026-10-17T00:00:00.000Z", valorRealizado: "3" }, desvio: -1,
    }],
  }]} />);
  assert.match(html, /Metas de execução por projeto/);
  assert.match(html, /P-01 · Alça Viária/);
  assert.match(html, /Realizado informado<\/span><strong>4 km<\/strong>/);
  assert.match(html, /Esperado na data<\/span><strong>5 km<\/strong>/);
  assert.match(html, /Indicador: Extensão pronta/);
  assert.match(html, /href="\/iniciativas\/projeto-1"/);
});

test("orientações do prefeito e do consultor usam públicos distintos", () => {
  assert.match(overviewCopy("prefeito").title, /gabinete/);
  assert.match(overviewCopy("analista").title, /consultoria/);
  const secretaria = { projetos: 1, tarefasTotal: 3, classificacao: "DADOS_DEFASADOS" } as Parameters<typeof secretariaRecommendation>[0];
  assert.match(secretariaRecommendation(secretaria, "prefeito"), /Pedir uma posição/);
  assert.match(secretariaRecommendation(secretaria, "analista"), /Conferir as entregas/);
});
