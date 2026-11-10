/** Respostas fechadas de condição (catálogo QUIZ_P03+). */

export type AplicabilidadeCondicao = "sim" | "nao" | "a_avaliar";
export type SituacaoCondicao =
  | "em_analise"
  | "atendida"
  | "pendente"
  | "dispensada_com_fundamento";

export type CondicaoResposta = {
  codigo: string;
  aplicabilidade: AplicabilidadeCondicao;
  situacao: SituacaoCondicao;
  fundamento?: string;
  proximoPasso?: string;
  responsavel?: string;
  /** Campos abertos do projeto (valor, nº licença, etc.). */
  detalhes?: Record<string, string | number | null>;
};

export type CampoFollowUp = {
  chave: string;
  label: string;
  tipo: "texto" | "numero" | "moeda" | "textarea";
  obrigatorioQuando?: Array<"pendente" | "atendida">;
  placeholder?: string;
  ajuda?: string;
};

export function formatarDetalhes(
  detalhes?: Record<string, string | number | null> | null,
  labels?: Record<string, string>,
): string {
  if (!detalhes) return "";
  return Object.entries(detalhes)
    .filter(
      ([k, v]) =>
        k !== "_selecao" &&
        v !== null &&
        v !== undefined &&
        String(v).trim() !== "",
    )
    .map(([k, v]) => `${labels?.[k] || k}: ${v}`)
    .join("; ");
}

export type RespostaFechada =
  | "nao_se_aplica"
  | "a_avaliar"
  | "pendente"
  | "atendida";

export const RESPOSTA_FECHADA_LABEL: Record<RespostaFechada, string> = {
  nao_se_aplica: "Não se aplica",
  a_avaliar: "A avaliar: ainda precisamos conferir",
  pendente: "Aplica-se e está pendente",
  atendida: "Aplica-se e foi atendida",
};

export const RESPOSTA_FECHADA_OPCOES: RespostaFechada[] = [
  "a_avaliar",
  "pendente",
  "atendida",
  "nao_se_aplica",
];

export function respostaFechada(
  resposta: Pick<CondicaoResposta, "aplicabilidade" | "situacao">,
): RespostaFechada {
  if (resposta.aplicabilidade === "nao") return "nao_se_aplica";
  if (
    resposta.aplicabilidade === "sim" &&
    (resposta.situacao === "atendida" ||
      resposta.situacao === "dispensada_com_fundamento")
  ) {
    return "atendida";
  }
  if (resposta.aplicabilidade === "sim" && resposta.situacao === "pendente") {
    return "pendente";
  }
  return "a_avaliar";
}

export function deRespostaFechada(
  value: RespostaFechada,
): Pick<CondicaoResposta, "aplicabilidade" | "situacao"> {
  if (value === "nao_se_aplica") {
    return { aplicabilidade: "nao", situacao: "dispensada_com_fundamento" };
  }
  if (value === "atendida") {
    return { aplicabilidade: "sim", situacao: "atendida" };
  }
  if (value === "pendente") {
    return { aplicabilidade: "sim", situacao: "pendente" };
  }
  return { aplicabilidade: "a_avaliar", situacao: "em_analise" };
}

export function condicaoBloqueia(
  resposta: Pick<CondicaoResposta, "aplicabilidade" | "situacao">,
) {
  if (resposta.aplicabilidade === "nao") return false;
  if (resposta.aplicabilidade === "a_avaliar") return true;
  return (
    resposta.situacao !== "atendida" &&
    resposta.situacao !== "dispensada_com_fundamento"
  );
}

export function valorFechadoDeResposta(
  valor: string | number | boolean | null | undefined | CondicaoResposta,
): RespostaFechada | null {
  if (valor === null || valor === undefined || valor === "") return null;
  if (typeof valor === "object" && "aplicabilidade" in valor) {
    return respostaFechada(valor);
  }
  const s = String(valor);
  if (
    s === "nao_se_aplica" ||
    s === "a_avaliar" ||
    s === "pendente" ||
    s === "atendida"
  ) {
    return s;
  }
  // Legado SIM/NAO
  if (s === "SIM") return "atendida";
  if (s === "NAO") return "pendente";
  if (s === "EM_ANDAMENTO") return "a_avaliar";
  return null;
}

export function parseCondicaoResposta(
  codigo: string,
  valor: unknown,
): CondicaoResposta {
  if (valor && typeof valor === "object" && !Array.isArray(valor)) {
    const o = valor as Record<string, unknown>;
    const detalhes =
      o.detalhes && typeof o.detalhes === "object" && !Array.isArray(o.detalhes)
        ? (o.detalhes as Record<string, string | number | null>)
        : undefined;
    if (o.aplicabilidade && o.situacao) {
      return {
        codigo,
        aplicabilidade: o.aplicabilidade as AplicabilidadeCondicao,
        situacao: o.situacao as SituacaoCondicao,
        fundamento: typeof o.fundamento === "string" ? o.fundamento : undefined,
        proximoPasso:
          typeof o.proximoPasso === "string" ? o.proximoPasso : undefined,
        responsavel: typeof o.responsavel === "string" ? o.responsavel : undefined,
        detalhes,
      };
    }
    if (typeof o.fechada === "string") {
      return {
        codigo,
        ...deRespostaFechada(o.fechada as RespostaFechada),
        fundamento: typeof o.fundamento === "string" ? o.fundamento : undefined,
        proximoPasso:
          typeof o.proximoPasso === "string" ? o.proximoPasso : undefined,
        responsavel: typeof o.responsavel === "string" ? o.responsavel : undefined,
        detalhes,
      };
    }
  }
  const fechada = valorFechadoDeResposta(
    valor as string | number | boolean | null,
  );
  return {
    codigo,
    ...(fechada
      ? deRespostaFechada(fechada)
      : { aplicabilidade: "a_avaliar" as const, situacao: "em_analise" as const }),
  };
}
