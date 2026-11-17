import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PAINEL_TOC } from "@cip/shared";
import { GovernoGlance } from "./governo-glance";
import type { OverviewResponse } from "./types";

test("indicadores do governo mostram contagens e links para consulta", () => {
  const data: OverviewResponse["data"] = {
    governo: {
      totalProjetos: 7, projetosComAtraso: 0, pctCarteiraComAtraso: 0,
      semAtrasoRegistrado: 7, atencaoExecutiva: 0, totalTarefas: 26,
      concluidas: 0, abertas: 26, atrasadas: 0, semPrazo: 0,
      indicePonderado: 0, metodoVersao: "teste",
    },
    agenda: { entraves: [], estruturantesAtrasados: 0, pastasDesatualizadas: [], gravidadeBuckets: {} },
    porSecretaria: [],
    projetosEstruturantes: [],
    pendencias: [],
  };
  const html = renderToStaticMarkup(<GovernoGlance data={data} />);
  assert.match(html, /href="\/carteira"><strong>7<\/strong><span>Total de projetos<\/span>/);
  assert.match(html, /href="\/relatorios\/metas"><strong>0<\/strong><span>Metas estratégicas<\/span>/);
  assert.match(html, /href="\/relatorios\/tarefas"><strong>26<\/strong><span>Tarefas de execução<\/span>/);
});

test("navegação do painel aponta apenas para seções existentes", () => {
  assert.ok(PAINEL_TOC.some((item) => item.id === "meta-estrategica"));
  assert.ok(!PAINEL_TOC.some((item) => /meta.execucao/i.test(item.id)));
});

test("ao destacar metas para o prefeito, a execução registrada continua disponível", () => {
  const data = {
    governo: {
      totalProjetos: 2, projetosComAtraso: 1, pctCarteiraComAtraso: 50,
      semAtrasoRegistrado: 1, atencaoExecutiva: 1, totalTarefas: 8,
      concluidas: 3, abertas: 5, atrasadas: 1, semPrazo: 0,
      indicePonderado: 0, metodoVersao: "teste",
    },
    agenda: { entraves: [], estruturantesAtrasados: 0, pastasDesatualizadas: [], gravidadeBuckets: {} },
    porSecretaria: [], projetosEstruturantes: [], pendencias: [],
  } as OverviewResponse["data"];
  const html = renderToStaticMarkup(<GovernoGlance data={data} role="prefeito" showGoals={false} heroId="execucao" />);
  assert.match(html, /Execução registrada nos projetos/);
  assert.match(html, /Tarefas de execução/);
  assert.match(html, /<strong>8<\/strong>/);
  assert.doesNotMatch(html, /id="meta-estrategica"/);
});

test("aba de acompanhamento não repete a seção de secretarias", () => {
  const data = {
    governo: {
      totalProjetos: 1, projetosComAtraso: 0, pctCarteiraComAtraso: 0,
      semAtrasoRegistrado: 1, atencaoExecutiva: 0, totalTarefas: 1,
      concluidas: 0, abertas: 1, atrasadas: 0, semPrazo: 0,
      indicePonderado: 0, metodoVersao: "teste",
    },
    agenda: { entraves: [], estruturantesAtrasados: 0, pastasDesatualizadas: [], gravidadeBuckets: {} },
    porSecretaria: [], projetosEstruturantes: [], pendencias: [],
  } as OverviewResponse["data"];
  const html = renderToStaticMarkup(<GovernoGlance data={data} role="prefeito" showGoals={false} showSecretarias={false} />);
  assert.match(html, /id="atencao"/);
  assert.doesNotMatch(html, /id="secretarias"/);
});
