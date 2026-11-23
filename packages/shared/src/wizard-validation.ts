import { parseCondicaoResposta, respostaFechada } from "./condicao-resposta";
import { visibleQuestions, type ModeloSnapshot, type RespostaViabilidade } from "./wizard-engine";

/** Campos numéricos opcionais continuam opcionais; valores informados devem ser válidos. */
export function validarNumerosDoWizard(modelo: ModeloSnapshot, respostas: RespostaViabilidade[]): string | null {
  const valores = new Map(respostas.map((resposta) => [resposta.perguntaCodigo, resposta.valor]));
  function validar(valor: unknown, rotulo: string, inteiro: boolean): string | null {
    if (valor === null || valor === undefined || valor === "") return null;
    const numero = typeof valor === "number" ? valor
      : typeof valor === "string" && valor.trim() ? Number(valor.trim().replace(",", ".")) : NaN;
    if (!Number.isFinite(numero) || numero < 0 || (inteiro && !Number.isInteger(numero))) {
      return `${rotulo}: informe ${inteiro ? "um número inteiro" : "um valor"} maior ou igual a zero.`;
    }
    return null;
  }
  for (const pergunta of visibleQuestions(modelo.perguntas, respostas)) {
    const valor = valores.get(pergunta.codigo);
    if (pergunta.tipoResposta === "NUMERO") {
      const erro = validar(valor, pergunta.rotulo || pergunta.texto, true);
      if (erro) return erro;
    }
    const parsed = parseCondicaoResposta(pergunta.codigo, valor);
    const selecao = typeof valor === "string" ? valor : parsed.detalhes?._selecao;
    const mostrarDetalhes = pergunta.tipoResposta === "SELECAO"
      ? typeof selecao === "string" && Boolean(selecao) && (!pergunta.opcoesComDetalhes || pergunta.opcoesComDetalhes.includes(selecao))
      : ["pendente", "atendida"].includes(respostaFechada(parsed));
    if (!mostrarDetalhes) continue;
    for (const campo of pergunta.camposFollowUp || []) {
      if (campo.tipo !== "moeda" && campo.tipo !== "numero") continue;
      const erro = validar(parsed.detalhes?.[campo.chave], campo.label, campo.tipo === "numero");
      if (erro) return erro;
    }
  }
  return null;
}
