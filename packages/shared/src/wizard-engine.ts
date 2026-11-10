import {
  valorFechadoDeResposta,
  type CondicaoResposta,
} from "./condicao-resposta";
import type {
  CicloIniciativa,
  ClassificacaoProjeto,
  EtapaStatus,
  ImpactoPergunta,
  PrioridadeNivel,
  TipoRespostaViabilidade,
} from "./status";
import { PRIORIDADE_NIVEL } from "./status";

export type CondicaoValor =
  | { eq: string | number | boolean }
  | { neq: string | number | boolean }
  | { in: Array<string | number> }
  | { lte: number }
  | { gte: number };

export type EfeitoPergunta = {
  quando: CondicaoValor;
  /**
   * Quando presente, exige também que o detalhe numérico do follow-up
   * satisfaça lte/gte (ex.: dias_restantes ≤ 2).
   */
  detalhe?: { chave: string; lte?: number; gte?: number };
  ciclo?: CicloIniciativa;
  rotuloBloqueio?: string;
  alertaResponsavel?: boolean;
  incluirEstrutura?: string[];
  /** Eleva a prioridade quando a condição vale (nunca rebaixa). */
  elevaPrioridade?: PrioridadeNivel;
  /** Motivo exibido junto à prioridade. */
  motivoPrioridade?: string;
};

export type ModeloPerguntaDef = {
  codigo: string;
  texto: string;
  tipoResposta: TipoRespostaViabilidade;
  impacto: ImpactoPergunta;
  obrigatoria?: boolean;
  ordem: number;
  dependeDeCodigo?: string | null;
  dependeDeValor?: CondicaoValor | null;
  opcoes?: string[] | null;
  efeitos?: EfeitoPergunta[];
  /** Etapa da sequência legal / grupo (1..n). Sem etapa = triagem (urgência/impacto). */
  etapa?: number | null;
  /** Grupo UX (planejamento, recursos, preparacao, operacao). */
  grupo?: string | null;
  /** Título curto exibido no card. */
  rotulo?: string | null;
  /** Frase de checagem (se ausente, usar texto). */
  pergunta?: string | null;
  /** Rótulo de espera quando pendente. */
  espera?: string | null;
  /** Valores que contam como situação favorável. Sem lista, a pergunta é apenas informativa. */
  favoraveis?: string[] | null;
  /** Orientação e fundamento legal exibidos ao responsável. */
  ajuda?: string | null;
  metadados?: { seNao?: string; sePendente?: string } | null;
  /** Campos abertos exibidos quando a condição se aplica. */
  camposFollowUp?: Array<{
    chave: string;
    label: string;
    tipo: "texto" | "numero" | "moeda" | "textarea";
    obrigatorioQuando?: Array<"pendente" | "atendida">;
    placeholder?: string;
    ajuda?: string;
  }> | null;
  /** Opções da seleção que pedem os dados complementares. */
  opcoesComDetalhes?: string[] | null;
};

export type ModeloEstruturaDef = {
  codigo: string;
  nivel: "META" | "TAREFA" | "SUBTAREFA";
  parentCodigo?: string | null;
  nome: string;
  indicador?: string | null;
  alvo?: string | null;
  ordem: number;
  sempreIncluir?: boolean;
};

export type EtapaDef = {
  ordem: number;
  codigo: string;
  nome: string;
  descricao?: string | null;
};

export type ModeloSnapshot = {
  codigo: string;
  nome: string;
  perguntas: ModeloPerguntaDef[];
  estrutura: ModeloEstruturaDef[];
  etapas?: EtapaDef[];
};

export type RespostaViabilidade = {
  perguntaCodigo: string;
  /** Valor simples ou objeto CondicaoResposta (CONDICAO_FECHADA). */
  valor: string | number | boolean | null | CondicaoResposta | Record<string, unknown>;
};

export type TreeNode = {
  codigo: string;
  nivel: "META" | "TAREFA" | "SUBTAREFA";
  nome: string;
  indicador?: string | null;
  alvo?: string | null;
  /** Quem responde pela meta, tarefa ou subtarefa. */
  responsavel?: string | null;
  /** Prazo ISO (apenas tarefas). */
  prazo?: string | null;
  origemPerguntaCodigo?: string | null;
  origemValor?: string | null;
  children: TreeNode[];
};

export type BloqueioAtivo = {
  perguntaCodigo: string;
  rotulo: string;
};

export type EtapaResumo = {
  ordem: number;
  codigo: string;
  nome: string;
  status: EtapaStatus;
  /** Perguntas da etapa que têm resposta. */
  respondidas: number;
  /** Perguntas da etapa com situação favorável. */
  favoraveis: number;
  /** Perguntas da etapa que contam para o avanço (visíveis e com lista de favoráveis). */
  total: number;
};

export type WizardEvaluateInput = {
  modelo: ModeloSnapshot;
  respostas: RespostaViabilidade[];
  classificacaoPrincipal: ClassificacaoProjeto;
};

export type WizardEvaluateResult = {
  cicloInicial: CicloIniciativa;
  bloqueios: BloqueioAtivo[];
  bloqueioLabel: string | null;
  estrutura: TreeNode[];
  avisos: string[];
  /** Importância/urgência do projeto. Dimensão independente do ciclo. */
  prioridade: PrioridadeNivel;
  motivosPrioridade: string[];
  /** Percentual de perguntas de etapa com situação favorável. Null se não há checklist. */
  prontidaoPct: number | null;
  etapas: EtapaResumo[];
  /** Código da primeira etapa não concluída, ou null se a sequência terminou. */
  etapaAtual: string | null;
};

type Valor = string | number | boolean | null | CondicaoResposta | Record<string, unknown>;

function valorParaMatch(valor: Valor | undefined): string | number | boolean | null {
  if (valor === null || valor === undefined || valor === "") return null;
  if (typeof valor === "object") {
    const o = valor as Record<string, unknown>;
    if (typeof o._selecao === "string" && o._selecao) return o._selecao;
    const detalhes = o.detalhes as Record<string, unknown> | undefined;
    if (typeof detalhes?._selecao === "string" && detalhes._selecao) return detalhes._selecao;
    return valorFechadoDeResposta(valor as CondicaoResposta) ?? null;
  }
  return valor;
}

function matchCondicao(valor: Valor | undefined, cond?: CondicaoValor | null) {
  if (!cond) return true;
  const v = valorParaMatch(valor);
  if (v === null || v === undefined || v === "") return false;
  if ("eq" in cond) return v === cond.eq;
  if ("neq" in cond) return v !== cond.neq;
  if ("in" in cond) return cond.in.includes(v as string | number);
  const n = typeof v === "number" ? v : Number(v);
  if (Number.isNaN(n)) return false;
  if ("lte" in cond) return n <= cond.lte;
  if ("gte" in cond) return n >= cond.gte;
  return false;
}

function detalheNumero(valor: Valor | undefined, chave: string): number | null {
  if (!valor || typeof valor !== "object") return null;
  const detalhes = (valor as CondicaoResposta).detalhes;
  if (!detalhes) return null;
  const raw = detalhes[chave];
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isNaN(n) ? null : n;
}

function matchEfeito(valor: Valor | undefined, efeito: EfeitoPergunta) {
  if (!matchCondicao(valor, efeito.quando)) return false;
  if (!efeito.detalhe) return true;
  const n = detalheNumero(valor, efeito.detalhe.chave);
  if (n === null) return false;
  if (efeito.detalhe.lte !== undefined && !(n <= efeito.detalhe.lte)) return false;
  if (efeito.detalhe.gte !== undefined && !(n >= efeito.detalhe.gte)) return false;
  return true;
}

function temValor(valor: Valor | undefined) {
  if (valor === null || valor === undefined || valor === "") return false;
  if (typeof valor === "object") {
    if (typeof (valor as CondicaoResposta).detalhes?._selecao === "string") return true;
    return valorFechadoDeResposta(valor as CondicaoResposta) !== null;
  }
  return true;
}

function valorExibido(valor: Valor | undefined): string {
  const v = valorParaMatch(valor);
  return v === null || v === undefined ? "" : String(v);
}

function contaParaEtapa(p: ModeloPerguntaDef) {
  return p.tipoResposta === "TEXTO" || (Array.isArray(p.favoraveis) && p.favoraveis.length > 0);
}

function isFavoravel(p: ModeloPerguntaDef, valor: Valor | undefined) {
  if (!contaParaEtapa(p) || !temValor(valor)) return false;
  if (p.tipoResposta === "TEXTO") return typeof valor === "string" && Boolean(valor.trim());
  const v = valorParaMatch(valor);
  return (p.favoraveis as string[]).includes(String(v));
}

function respostaMap(respostas: RespostaViabilidade[]) {
  const map = new Map<string, Valor>();
  for (const r of respostas) map.set(r.perguntaCodigo, r.valor);
  return map;
}

/** Perguntas visíveis conforme dependências. */
export function visibleQuestions(
  perguntas: ModeloPerguntaDef[],
  respostas: RespostaViabilidade[],
): ModeloPerguntaDef[] {
  const map = respostaMap(respostas);
  return [...perguntas]
    .sort((a, b) => a.ordem - b.ordem)
    .filter((p) => {
      if (!p.dependeDeCodigo) return true;
      return matchCondicao(map.get(p.dependeDeCodigo) ?? null, p.dependeDeValor);
    });
}

function buildTree(
  items: ModeloEstruturaDef[],
  included: Set<string>,
  origem: Map<string, { perguntaCodigo: string; valor: string }>,
): TreeNode[] {
  const byParent = new Map<string | null, ModeloEstruturaDef[]>();
  for (const item of items) {
    if (!included.has(item.codigo) && !item.sempreIncluir) continue;
    if (item.sempreIncluir) included.add(item.codigo);
    const key = item.parentCodigo || null;
    const list = byParent.get(key) || [];
    list.push(item);
    byParent.set(key, list);
  }

  function walk(parent: string | null): TreeNode[] {
    const list = (byParent.get(parent) || []).sort((a, b) => a.ordem - b.ordem);
    return list
      .filter((i) => included.has(i.codigo))
      .map((i) => {
        const o = origem.get(i.codigo);
        return {
          codigo: i.codigo,
          nivel: i.nivel,
          nome: i.nome,
          indicador: i.indicador,
          alvo: i.alvo,
          origemPerguntaCodigo: o?.perguntaCodigo ?? null,
          origemValor: o?.valor ?? null,
          children: walk(i.codigo),
        };
      });
  }

  return walk(null);
}

/** Maior nível de prioridade disparado por qualquer pergunta visível. */
function avaliarPrioridade(
  visibles: ModeloPerguntaDef[],
  map: Map<string, Valor>,
): { prioridade: PrioridadeNivel; motivos: string[] } {
  let rank = 0;
  const motivos: string[] = [];
  for (const p of visibles) {
    const valor = map.get(p.codigo) ?? null;
    for (const efeito of p.efeitos || []) {
      if (!efeito.elevaPrioridade) continue;
      if (!matchEfeito(valor, efeito)) continue;
      rank = Math.max(rank, PRIORIDADE_NIVEL.indexOf(efeito.elevaPrioridade));
      if (efeito.motivoPrioridade && !motivos.includes(efeito.motivoPrioridade)) {
        motivos.push(efeito.motivoPrioridade);
      }
    }
  }
  return { prioridade: PRIORIDADE_NIVEL[rank], motivos };
}

/** Status de cada etapa da sequência legal, etapa atual e avisos de ordem. */
function avaliarEtapas(
  etapas: EtapaDef[],
  visibles: ModeloPerguntaDef[],
  map: Map<string, Valor>,
): { resumo: EtapaResumo[]; etapaAtual: string | null; avisos: string[] } {
  const ordenadas = [...etapas].sort((a, b) => a.ordem - b.ordem);
  const resumo: EtapaResumo[] = ordenadas.map((etapa) => {
    const doGrupo = visibles.filter((p) => p.etapa === etapa.ordem);
    const contados = doGrupo.filter(contaParaEtapa);
    const respondidas = contados.filter((p) => temValor(map.get(p.codigo))).length;
    const favoraveis = contados.filter((p) => isFavoravel(p, map.get(p.codigo))).length;
    // Bloqueia quando um item bloqueante foi respondido de forma desfavorável.
    const bloqueada = contados.some(
      (p) =>
        p.impacto === "BLOQUEANTE" &&
        temValor(map.get(p.codigo)) &&
        !isFavoravel(p, map.get(p.codigo)),
    );

    let status: EtapaStatus;
    if (contados.length === 0) status = "NAO_APLICAVEL";
    else if (favoraveis === contados.length) status = "CONCLUIDA";
    else if (bloqueada) status = "BLOQUEADA";
    else if (respondidas === 0) status = "PENDENTE";
    else status = "EM_ANDAMENTO";

    return {
      ordem: etapa.ordem,
      codigo: etapa.codigo,
      nome: etapa.nome,
      status,
      respondidas,
      favoraveis,
      total: contados.length,
    };
  });

  const encerrada = (s: EtapaStatus) => s === "CONCLUIDA" || s === "NAO_APLICAVEL";
  const etapaAtual = resumo.find((e) => !encerrada(e.status))?.codigo ?? null;

  const avisos: string[] = [];
  resumo.forEach((etapa, i) => {
    if (etapa.status !== "EM_ANDAMENTO" && etapa.status !== "CONCLUIDA") return;
    // Aponta a etapa imediatamente anterior ainda não concluída (a causa mais próxima).
    const anterior = resumo
      .slice(0, i)
      .reverse()
      .find((e) => !encerrada(e.status));
    if (anterior) {
      avisos.push(
        `Etapa "${etapa.nome}" avança antes de "${anterior.nome}" ser concluída. Confirme a sequência legal.`,
      );
    }
  });

  return { resumo, etapaAtual, avisos };
}

function prontidao(resumo: EtapaResumo[]): number | null {
  const total = resumo.reduce((acc, e) => acc + e.total, 0);
  if (!total) return null;
  const ok = resumo.reduce((acc, e) => acc + e.favoraveis, 0);
  return Math.round((ok / total) * 100);
}

export function evaluateWizard(input: WizardEvaluateInput): WizardEvaluateResult {
  const avisos: string[] = [];
  const map = respostaMap(input.respostas);
  const bloqueios: BloqueioAtivo[] = [];
  const included = new Set<string>();
  const origem = new Map<string, { perguntaCodigo: string; valor: string }>();

  for (const item of input.modelo.estrutura) {
    if (item.sempreIncluir) included.add(item.codigo);
  }

  const visibles = visibleQuestions(input.modelo.perguntas, input.respostas);

  for (const p of visibles) {
    if (p.obrigatoria && !temValor(map.get(p.codigo))) {
      avisos.push(`Pergunta obrigatória sem resposta: ${p.codigo}`);
    }

    const valor = map.get(p.codigo) ?? null;
    const fechada = valorFechadoDeResposta(
      valor as string | number | boolean | null | CondicaoResposta,
    );

    // CONDICAO_FECHADA bloqueante: a_avaliar / pendente gera espera.
    if (
      p.tipoResposta === "CONDICAO_FECHADA" &&
      p.impacto === "BLOQUEANTE" &&
      (fechada === "a_avaliar" || fechada === "pendente")
    ) {
      bloqueios.push({
        perguntaCodigo: p.codigo,
        rotulo: p.espera || `Aguardando: ${p.rotulo || p.texto}`,
      });
    }

    for (const efeito of p.efeitos || []) {
      if (!matchEfeito(valor, efeito)) continue;

      if (efeito.ciclo === "AGUARDANDO_PRE_REQUISITO") {
        bloqueios.push({
          perguntaCodigo: p.codigo,
          rotulo:
            efeito.rotuloBloqueio ||
            p.espera ||
            `Aguardando: ${p.rotulo || p.texto}`,
        });
      }

      for (const codigo of efeito.incluirEstrutura || []) {
        included.add(codigo);
        let cur: ModeloEstruturaDef | undefined = input.modelo.estrutura.find(
          (e) => e.codigo === codigo,
        );
        while (cur?.parentCodigo) {
          included.add(cur.parentCodigo);
          const parentCodigo = cur.parentCodigo;
          cur = input.modelo.estrutura.find((e) => e.codigo === parentCodigo);
        }
        origem.set(codigo, {
          perguntaCodigo: p.codigo,
          valor: valorExibido(valor),
        });
      }
    }
  }

  // Deduplicate bloqueios
  const uniqueBloqueios = Array.from(
    new Map(bloqueios.map((b) => [b.perguntaCodigo, b])).values(),
  );

  const cicloInicial: CicloIniciativa = uniqueBloqueios.length
    ? "AGUARDANDO_PRE_REQUISITO"
    : "EM_PLANEJAMENTO";

  const { prioridade, motivos } = avaliarPrioridade(visibles, map);
  const etapasDef = input.modelo.etapas ?? [];
  const { resumo, etapaAtual, avisos: avisosOrdem } = avaliarEtapas(
    etapasDef,
    visibles,
    map,
  );
  avisos.push(...avisosOrdem);

  return {
    cicloInicial,
    bloqueios: uniqueBloqueios,
    bloqueioLabel: uniqueBloqueios[0]?.rotulo ?? null,
    estrutura: buildTree(input.modelo.estrutura, included, origem),
    avisos,
    prioridade,
    motivosPrioridade: motivos,
    prontidaoPct: prontidao(resumo),
    etapas: resumo,
    etapaAtual,
  };
}

/** Reavalia respostas já persistidas (mesma lógica do evaluate). */
export function reavaliarRespostas(input: WizardEvaluateInput): WizardEvaluateResult {
  return evaluateWizard(input);
}
