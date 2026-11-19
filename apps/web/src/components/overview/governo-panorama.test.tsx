import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { GovernoOverview } from "./governo-overview";
import { GovernoAnalises } from "./governo-analises";
import { SecretariaSaude } from "./secretaria-saude";
import { hasSecretariaStatus, secretariaDimensions } from "./overview-model";
import type { OverviewResponse, SecretariaOverview } from "./types";

function secretaria(i: number): SecretariaOverview {
  return { id: `pasta-${i}`, nome: `Secretaria ${i}`, projetos: 2, projetosComAtraso: 1, projetosAtencaoExecutiva: 1,
    tarefasTotal: 10, abertas: 7, concluidas: 3, noPrazo: 4, atrasadas: 2, semPrazo: 1, criticas: 1,
    pctAtraso: 28.6, indicePonderado: 20, diasSemAtualizacao: 0, classificacao: "ACOMPANHAMENTO" };
}
function fixture(): OverviewResponse {
  return { data: {
    governo: { totalProjetos: 26, projetosComAtraso: 13, pctCarteiraComAtraso: 50, semAtrasoRegistrado: 13,
      atencaoExecutiva: 13, totalTarefas: 130, concluidas: 39, abertas: 91, atrasadas: 26, semPrazo: 13, indicePonderado: 20, metodoVersao: "teste" },
    porSecretaria: Array.from({ length: 13 }, (_, i) => secretaria(i + 1)),
    agenda: { entraves: [], estruturantesAtrasados: 0, pastasDesatualizadas: [], gravidadeBuckets: {} }, projetosEstruturantes: [], pendencias: [],
  }, meta: { dataReferencia: "2026-11-19T00:00:00.000Z", fonte: "Base de teste" } };
}

test("prefeito e consultor veem todas as secretarias no panorama inicial, incluindo pastas sem projetos", () => {
  for (const role of ["prefeito", "analista"]) {
    const payload = fixture();
    Object.assign(payload.data.porSecretaria[12], { projetos: 0, tarefasTotal: 0, concluidas: 0, abertas: 0, noPrazo: 0, atrasadas: 0, semPrazo: 0 });
    const html = renderToStaticMarkup(<GovernoOverview payload={payload} municipio="Modelo" role={role} />);
    assert.equal((html.match(/class="gov-map-card"/g) ?? []).length, 13);
    for (let i = 1; i <= 13; i++) assert.ok(html.includes(`aria-label="Secretaria ${i}:`));
    assert.match(html, /Secretaria 13: Sem projetos/);
    assert.match(html, /70% das tarefas concluídas ou dentro do prazo/);
    assert.doesNotMatch(html, /Metas e indicadores|BSC|OKR/);
  }
});

test("pastas sem tarefas têm classificação própria e não inflam as contagens de acompanhamento", () => {
  const p = { ...secretaria(1), tarefasTotal: 0, projetos: 0, classificacao: "ROTINA" };
  assert.equal(hasSecretariaStatus(p, "ROTINA"), false);
  assert.equal(hasSecretariaStatus(p, "SEM_TAREFAS"), true);
  assert.equal(hasSecretariaStatus(p, "SEM_PROJETOS"), true);
  assert.equal(hasSecretariaStatus(p, ""), true);
});

test("radar preserva os denominadores e não inventa valores sem tarefas abertas", () => {
  const p = secretaria(1);
  assert.equal(secretariaDimensions(p)[0].value, 70);
  assert.equal(secretariaDimensions(p)[3].value, 80);
  const html = renderToStaticMarkup(<SecretariaSaude secretaria={p} />);
  assert.match(html, /Execução em dia: 70%/);
  assert.match(html, /Controle da gravidade: 80%/);
  const closed = { ...p, tarefasTotal: 3, concluidas: 3, noPrazo: 0, abertas: 0, atrasadas: 0, semPrazo: 0 };
  assert.deepEqual(secretariaDimensions(closed).map((d) => d.value), [100, null, null, null]);
  const noOpen = renderToStaticMarkup(<SecretariaSaude secretaria={closed} />);
  assert.match(noOpen, /Sem tarefas abertas/);
  assert.doesNotMatch(noOpen, /<svg|NaN|Infinity/);
});

test("análises recuperam entraves, gravidade e evidências sem omitir atrasos sem classificação", () => {
  const payload = fixture();
  payload.data.agenda.entraves = [{ tipo: "ORCAMENTARIO", qtd: 2 }];
  payload.data.agenda.gravidadeBuckets = { CRITICA: 20 };
  const html = renderToStaticMarkup(<GovernoAnalises data={payload.data} role="prefeito" onFilter={() => {}} />);
  assert.match(html, /Sem classificação informada<\/span><strong>6<\/strong>/);
  assert.match(html, /Evidências aguardando conferência<\/dt><dd>Não informado/);
  assert.match(html, /href="\/carteira\/estruturante"/);
});
