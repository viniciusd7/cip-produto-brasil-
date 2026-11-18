import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PrefeitoExecutiveFocus, PrefeitoExecutionGoals } from "./prefeito-overview";
import { overviewCopy, secretariaRecommendation } from "./audience";

const meta = {
  id: "meta-1", nome: "Mobilidade urbana", codigo: "ME-01", unidade: "%",
  secretariaId: "obras", secretariaNome: "Secretaria de Obras",
  resultadoChaveOkr: "Concluir a etapa prevista",
  projetosVinculados: [{ id: "projeto-1", codigo: "P-01", nome: "Alça Viária" }],
  indicadores: [{ id: "indicador-1", nome: "Trecho entregue", unidade: "%", valorAtual: "30", alvo: "100" }],
  medicaoAtual: { dataCorte: "2026-11-17T00:00:00.000Z", valorRealizado: "30", valorEsperado: "40", fonte: "Medição municipal" },
  medicaoAnterior: { dataCorte: "2026-10-17T00:00:00.000Z", valorRealizado: "20" },
  desvio: -10,
};

test("bloco executivo mostra medições e fonte sem misturar contagem operacional", () => {
  const html = renderToStaticMarkup(<PrefeitoExecutiveFocus metas={[meta]} dataReferencia="2026-11-17T00:00:00.000Z" />);
  assert.match(html, /Metas e indicadores do governo/);
  assert.match(html, /Resultado registrado<\/dt><dd>30 %<\/dd>/);
  assert.match(html, /Previsto para 17\/11\/2026<\/dt><dd>40 %<\/dd>/);
  assert.match(html, /Ver medição anterior/);
  assert.match(html, /resultado registrado foi <strong>20 %<\/strong>/);
  assert.match(html, /Fonte: Medição municipal/);
  assert.match(html, /Secretaria de Obras/);
  assert.match(html, /href="\/iniciativas\/projeto-1\?aba=metas">Alça Viária/);
  assert.doesNotMatch(html, /tarefas concluídas|Tarefas de execução|Próxima cobrança|Desvio numérico|Não calculável/);
});

test("meta sem medição fica pendente sem percentual presumido", () => {
  const html = renderToStaticMarkup(<PrefeitoExecutiveFocus metas={[{ ...meta, medicaoAtual: null, medicaoAnterior: null, desvio: null }]} />);
  assert.match(html, /Sem medição datada/);
  assert.match(html, /Os valores cadastrados nos indicadores estão abaixo/);
  assert.match(html, /Valor informado<\/dt><dd>30 %<\/dd>/);
  assert.doesNotMatch(html, /Resultado registrado<\/dt>|Desvio numérico|Não calculável/);
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
  assert.match(html, /Resultados registrados nos projetos/);
  assert.match(html, /Alça Viária/);
  assert.match(html, /Resultado registrado<\/dt><dd>4 km<\/dd>/);
  assert.match(html, /Previsto para 17\/11\/2026<\/dt><dd>5 km<\/dd>/);
  assert.match(html, /O que é acompanhado: Extensão pronta/);
  assert.match(html, /href="\/iniciativas\/projeto-1\?aba=metas"/);
});

test("zero medido continua sendo um resultado e unidade já informada não é duplicada", () => {
  const html = renderToStaticMarkup(<PrefeitoExecutiveFocus metas={[{
    ...meta,
    medicaoAtual: { ...meta.medicaoAtual, valorRealizado: "0", valorEsperado: "40%" },
  }]} />);
  assert.match(html, /Resultado registrado<\/dt><dd>0 %<\/dd>/);
  assert.match(html, /Previsto para 17\/11\/2026<\/dt><dd>40%<\/dd>/);
  assert.match(html, /Medição registrada/);
  assert.doesNotMatch(html, /40% %/);
});

test("valor menor em indicador de redução não recebe classificação automática de resultado ruim", () => {
  const html = renderToStaticMarkup(<PrefeitoExecutiveFocus metas={[{
    ...meta, nome: "Reduzir a espera", unidade: "dias",
    medicaoAtual: { ...meta.medicaoAtual, valorRealizado: "10", valorEsperado: "20" },
    medicaoAnterior: null, indicadores: [], desvio: -10,
  }]} />);
  assert.match(html, /<dd>10 dias<\/dd>/);
  assert.match(html, /<dd>20 dias<\/dd>/);
  assert.doesNotMatch(html, /-10|Atrasad|Piorou|Abaixo da meta|progressbar/);
});

test("ausência de dados mantém orientação de atualização e o alvo final separado da medição", () => {
  const html = renderToStaticMarkup(<PrefeitoExecutiveFocus metas={[{
    ...meta, medicaoAtual: null, medicaoAnterior: null, indicadores: [], alvo: "100", desvio: null,
  }]} />);
  assert.match(html, /Solicite a atualização dos resultados à secretaria responsável/);
  assert.match(html, /Resultado esperado ao final: <strong>100 %/);
  assert.doesNotMatch(html, /Resultado registrado<\/dt>|<dd>0/);
});

test("metas vazias e secretaria têm contexto próprio sem blocos de execução vazios", () => {
  const vazio = renderToStaticMarkup(<PrefeitoExecutiveFocus metas={[]} />);
  assert.match(vazio, /Ainda não há metas nesta visão/);
  assert.doesNotMatch(vazio, /Filtrar metas por medição/);
  const secretaria = renderToStaticMarkup(<PrefeitoExecutiveFocus metas={[meta]} escopo="secretaria" />);
  assert.match(secretaria, /Metas e indicadores da secretaria/);
  assert.equal(renderToStaticMarkup(<PrefeitoExecutionGoals projetos={[]} />), "");
});

test("orientações do prefeito e do consultor usam públicos distintos", () => {
  assert.match(overviewCopy("prefeito").title, /gabinete/);
  assert.match(overviewCopy("analista").title, /consultoria/);
  const secretaria = { projetos: 1, tarefasTotal: 3, classificacao: "DADOS_DEFASADOS" } as Parameters<typeof secretariaRecommendation>[0];
  assert.match(secretariaRecommendation(secretaria, "prefeito"), /Pedir uma posição/);
  assert.match(secretariaRecommendation(secretaria, "analista"), /Conferir as entregas/);
});
