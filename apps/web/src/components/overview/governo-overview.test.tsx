import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { GovernoOverview } from "./governo-overview";
import type { OverviewResponse } from "./types";

function fixture(): OverviewResponse {
  return {
    data: {
      governo: {
        totalProjetos: 2, projetosComAtraso: 1, pctCarteiraComAtraso: 50,
        semAtrasoRegistrado: 1, atencaoExecutiva: 1, totalTarefas: 10,
        concluidas: 3, abertas: 7, atrasadas: 2, semPrazo: 1,
        indicePonderado: 0, metodoVersao: "teste",
      },
      kpis: { pendenciasAbertas: 55 },
      agenda: { entraves: [], estruturantesAtrasados: 0, pastasDesatualizadas: [], gravidadeBuckets: {} },
      porSecretaria: [], projetosEstruturantes: [], pendencias: [],
      estrategia: {
        metas: [{
          id: "meta-1", nome: "Meta que pertence ao planejamento", projetos: 1,
          projetosVinculados: [], indicadores: [], desvio: null,
          aguardandoMedicao: true, medicaoAtual: null, medicaoAnterior: null,
        }],
        porPerspectivaBsc: [], alertasOrcamento: [], alertaEquipamentos: null,
      },
    },
    meta: { dataReferencia: "2026-11-16T00:00:00.000Z", fonte: "Base de teste" },
  };
}

test("visão geral de todos os perfis concentra a navegação em resumo, secretarias e projetos", () => {
  for (const role of ["prefeito", "analista", "admin", "leitura"]) {
    const html = renderToStaticMarkup(<GovernoOverview payload={fixture()} municipio="Prefeitura Modelo" role={role} />);
    assert.match(html, /<h1>Visão geral<\/h1>/);
    assert.equal((html.match(/role="tab"/g) ?? []).length, 3);
    assert.doesNotMatch(html, /Metas e indicadores|Meta que pertence ao planejamento|meta-estrategica|Análise detalhada|BSC|OKR/);
    assert.match(html, /Fonte: Base de teste/);
    assert.match(html, /16\/11\/2026/);
  }
});

test("resumo distingue tarefas concluídas, em dia, atrasadas e sem prazo e usa o total completo de providências", () => {
  const html = renderToStaticMarkup(<GovernoOverview payload={fixture()} municipio="Modelo" />);
  assert.match(html, /aria-label="Concluídas: 3; Dentro do prazo: 4; Atrasadas: 2; Sem prazo: 1"/);
  assert.match(html, /<strong>30%<\/strong>/);
  assert.match(html, /<strong>55<\/strong><span>providências em aberto/);
  assert.match(html, /Há 2 tarefas atrasadas e 1 sem prazo/);
  assert.doesNotMatch(html, /Tudo sob controle/);
});

test("ausência de cadastros e data inválida não produzem percentuais ou datas enganosas", () => {
  const payload = fixture();
  Object.assign(payload.data.governo, { totalProjetos: 0, totalTarefas: 0, concluidas: 0, abertas: 0, atrasadas: 0, semPrazo: 0 });
  payload.meta = { dataReferencia: "inválida" };
  const html = renderToStaticMarkup(<GovernoOverview payload={payload} municipio="Modelo" />);
  assert.match(html, /O acompanhamento começa aqui/);
  assert.match(html, /Data não informada/);
  assert.doesNotMatch(html, /NaN|Infinity|Invalid Date|Tudo sob controle/);
});

test("lista de atenção não duplica a mesma tarefa quando ela chega em mais de uma categoria", () => {
  const payload = fixture();
  const task = { id: "tarefa-1", descricao: "Revisar o prazo da obra", iniciativaId: "obra-1", iniciativaNome: "Obra", secretaria: "Obras" };
  payload.data.tarefasPedemAcao = {
    atrasadas: [{ ...task, gravidade: null, responsavel: null }],
    vencemEm15d: [{ ...task, prazo: null }], semPrazo: [],
  };
  const html = renderToStaticMarkup(<GovernoOverview payload={payload} municipio="Modelo" />);
  assert.equal((html.match(/Revisar o prazo da obra/g) ?? []).length, 1);
  assert.match(html, /href="\/iniciativas\/obra-1\?aba=andamento"/);
});
