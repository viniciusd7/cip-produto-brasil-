import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { TarefasGestao } from "../../app/(app)/minha-pasta/tarefas-gestao";
import { TabelaRelatorio } from "../../app/(app)/relatorios/tabela-relatorio";
import { GovernoGlance } from "./governo-glance";
import type { OverviewResponse } from "./types";

const TAREFA = "Tarefa histórica ligada";
const META_LEGADA = "Meta de execução histórica";

test("painel mantém tarefas e metas estratégicas sem apresentar metas de execução", () => {
  const data: OverviewResponse["data"] = {
    governo: {
      totalProjetos: 1,
      projetosComAtraso: 1,
      pctCarteiraComAtraso: 100,
      semAtrasoRegistrado: 0,
      atencaoExecutiva: 0,
      totalTarefas: 1,
      concluidas: 0,
      abertas: 1,
      atrasadas: 1,
      semPrazo: 0,
      indicePonderado: 0,
      metodoVersao: "teste",
    },
    agenda: { entraves: [], estruturantesAtrasados: 0, pastasDesatualizadas: [], gravidadeBuckets: {} },
    tarefasPedemAcao: {
      atrasadas: [{
        id: "tarefa-1",
        descricao: TAREFA,
        iniciativaId: "projeto-1",
        iniciativaNome: "Projeto histórico",
        secretaria: "Secretaria",
        gravidade: null,
        responsavel: null,
      }],
      vencemEm15d: [],
      semPrazo: [],
    },
    porSecretaria: [],
    projetosEstruturantes: [],
    pendencias: [],
    estrategia: {
      metas: [{
        id: "meta-estrategica",
        nome: "Meta estratégica preservada",
        projetos: 1,
        projetosVinculados: [{ id: "projeto-1", codigo: "P-1", nome: "Projeto histórico" }],
        indicadores: [{
          id: "indicador-1",
          nome: "Indicador real",
          valorBase: "20",
          valorAtual: "35",
          alvo: "80",
          unidade: "%",
          periodicidade: "MENSAL",
          ultimaMedicao: null,
        }],
        desvio: null,
        aguardandoMedicao: true,
        medicaoAtual: null,
        medicaoAnterior: null,
      }],
      porPerspectivaBsc: [],
      alertasOrcamento: [],
      alertaEquipamentos: null,
    },
  };
  const html = renderToStaticMarkup(<GovernoGlance data={data} />);

  assert.match(html, new RegExp(TAREFA));
  assert.match(html, /Metas estratégicas/);
  assert.match(html, /Meta estratégica preservada/);
  assert.match(html, /Projeto histórico/);
  assert.match(html, /Indicador real/);
  assert.match(html, /Base: 20 % · Atual: 35 % · Alvo: 80 %/);
  assert.doesNotMatch(html, /25%/);
  assert.doesNotMatch(html, /43%/);
  assert.doesNotMatch(html, /Metas de execução|Meta de execução histórica|Meta vencida/);
});

test("tarefas previamente vinculadas continuam visíveis na pasta sem o rótulo da meta", () => {
  const html = renderToStaticMarkup(
    <TarefasGestao
      token=""
      tarefas={[{
        id: "tarefa-1",
        codigo: "T-1",
        descricao: TAREFA,
        status: "NO_PRAZO",
        responsavel: "Responsável",
        prazo: null,
        meta: META_LEGADA,
        subtarefas: { total: 2, concluidas: 1 },
        iniciativaId: "projeto-1",
        iniciativaCodigo: "P-1",
        iniciativaNome: "Projeto histórico",
        secretaria: "Secretaria",
      }]}
    />,
  );

  assert.match(html, new RegExp(TAREFA));
  assert.doesNotMatch(html, new RegExp(META_LEGADA));
  assert.doesNotMatch(html, /Sem meta vinculada/);
});

test("relatório mantém a tarefa vinculada sem exibir rótulo da meta", () => {
  const html = renderToStaticMarkup(
    <TabelaRelatorio parametros="tipo=tarefas" consulta={{
      tipo: "tarefas", busca: "", ordenar: "tarefa", direcao: "asc", total: 1,
      colunas: [{ chave: "tarefa", rotulo: "Tarefa" }],
      linhas: [{ id: "tarefa-1", valores: { tarefa: TAREFA } }],
    }} />,
  );

  assert.match(html, new RegExp(TAREFA));
  assert.doesNotMatch(html, new RegExp(META_LEGADA));
  assert.doesNotMatch(html, /Sem meta vinculada/);
});
