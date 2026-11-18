import type { PrazoMarco } from "@cip/shared";
import { METODOLOGIA_SECRETARIAS } from "@cip/shared";

export type Gravidade = "LEVE" | "MODERADA" | "GRAVE" | "CRITICA";

const WEIGHT = METODOLOGIA_SECRETARIAS.pesosGravidade;

/** Índice ponderado = soma(pesos dos atrasos) / tarefas abertas. Versão metodológica v1. */
export const GRAVIDADE_METODO_VERSAO = METODOLOGIA_SECRETARIAS.versao;

export function pesoGravidade(g?: string | null) {
  if (!g) return WEIGHT.MODERADA;
  return WEIGHT[g as Gravidade] ?? WEIGHT.MODERADA;
}

export function derivarGravidade(params: {
  prazoStatus: PrazoMarco;
  prazoOriginal: Date | null;
  prazoVigente: Date | null;
  reprogramacoes: number;
  dataReferencia?: Date | null;
}): Gravidade | null {
  if (params.prazoStatus !== "VENCIDO") return null;
  const ref = params.dataReferencia ?? new Date();
  const base = params.prazoOriginal ?? params.prazoVigente;
  if (!base) return "MODERADA";
  const dias = Math.max(
    0,
    Math.floor((ref.getTime() - base.getTime()) / (1000 * 60 * 60 * 24)),
  );

  let g: Gravidade = "LEVE";
  if (dias >= 45) g = "CRITICA";
  else if (dias >= 21) g = "GRAVE";
  else if (dias >= 7) g = "MODERADA";

  if (params.reprogramacoes >= 2 && g === "LEVE") g = "MODERADA";
  if (params.reprogramacoes >= 3 && (g === "LEVE" || g === "MODERADA")) g = "GRAVE";
  if (params.prazoVigente && params.prazoVigente < ref && g !== "CRITICA") {
    // novo prazo também vencido eleva um nível
    if (g === "LEVE") g = "MODERADA";
    else if (g === "MODERADA") g = "GRAVE";
    else g = "CRITICA";
  }
  return g;
}

export function indicePonderado(atrasos: Array<{ gravidade?: string | null }>, abertas: number) {
  if (!abertas) return 0;
  const soma = atrasos.reduce((acc, a) => acc + pesoGravidade(a.gravidade), 0);
  return Math.round((soma / abertas) * 1000) / 10; // 1 casa percentual
}

export type ClassificacaoSecretaria =
  | "INTERVENCAO"
  | "ACOMPANHAMENTO"
  | "ROTINA"
  | "DADOS_DEFASADOS";

type IndicadoresSecretaria = {
  diasSemAtualizacao: number | null;
  pctAtrasoAbertas: number;
  indicePonderado: number;
  pctSemPrazoAbertas: number;
};

export function avaliarSecretaria(params: IndicadoresSecretaria): {
  classificacao: ClassificacaoSecretaria;
  motivos: string[];
} {
  const regras = METODOLOGIA_SECRETARIAS;
  const percentual = (valor: number) => `${valor.toLocaleString("pt-BR")}%`;
  if (params.diasSemAtualizacao != null && params.diasSemAtualizacao > regras.diasSemAtualizacao) {
    return {
      classificacao: "DADOS_DEFASADOS",
      motivos: [`${params.diasSemAtualizacao} dias sem atualização dos projetos, acima do limite de ${regras.diasSemAtualizacao} dias. Validar os dados antes de decidir.`],
    };
  }
  const motivos: string[] = [];
  if (params.pctAtrasoAbertas >= regras.intervencao.pctAtraso) {
    motivos.push(`${percentual(params.pctAtrasoAbertas)} das tarefas abertas estão atrasadas (limite: ${regras.intervencao.pctAtraso}%).`);
  }
  if (params.indicePonderado >= regras.intervencao.indicePonderado) {
    motivos.push(`Índice ponderado de atraso de ${percentual(params.indicePonderado)} (limite: ${regras.intervencao.indicePonderado}%).`);
  }
  if (motivos.length) return { classificacao: "INTERVENCAO", motivos };
  if (params.pctAtrasoAbertas >= regras.acompanhamento.pctAtraso) {
    motivos.push(`${percentual(params.pctAtrasoAbertas)} das tarefas abertas estão atrasadas (limite: ${regras.acompanhamento.pctAtraso}%).`);
  }
  if (params.pctSemPrazoAbertas >= regras.acompanhamento.pctSemPrazo) {
    motivos.push(`${percentual(params.pctSemPrazoAbertas)} das tarefas abertas estão sem prazo (limite: ${regras.acompanhamento.pctSemPrazo}%).`);
  }
  if (motivos.length) return { classificacao: "ACOMPANHAMENTO", motivos };
  return { classificacao: "ROTINA", motivos: ["Os indicadores estão abaixo dos limites de alerta."] };
}

export function classificarSecretaria(params: IndicadoresSecretaria): ClassificacaoSecretaria {
  return avaliarSecretaria(params).classificacao;
}
