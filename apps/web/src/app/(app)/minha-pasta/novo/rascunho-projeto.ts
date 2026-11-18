import type { CondicaoValorState } from "@/components/condicao-card";
import type { EscopoNo } from "./escopo-editor";
import { CODIGO_IMPEDIMENTO_PERSONALIZADO, LIMITE_IMPEDIMENTOS_PERSONALIZADOS, type ImpedimentoPersonalizado } from "@cip/shared";

const CAMPOS_TEXTO = [
  "secretariaId", "responsavelPessoaId", "novoNome", "novoCargo",
  "novoTelefone", "novoEmail", "nome", "codigo", "descricao", "entrega",
  "foraEscopo", "beneficiariosTxt", "metaId", "novaMetaNome", "planoId",
  "novoPlanoNome", "ultimoPassoGerado",
] as const;

export type RascunhoProjeto = Record<(typeof CAMPOS_TEXTO)[number], string> & {
  step: number;
  respostas: Record<string, CondicaoValorState>;
  secretariasCorrelatas: string[];
  escopo: EscopoNo[];
  impedimentosPersonalizados?: ImpedimentoPersonalizado[];
};

function objeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function textoOpcional(valor: unknown) {
  return valor === undefined || valor === null || typeof valor === "string";
}

function escopoValido(valor: unknown, profundidade = 0): valor is EscopoNo[] {
  return profundidade < 20 && Array.isArray(valor) && valor.every((no: unknown) =>
    objeto(no) && typeof no.codigo === "string" && typeof no.nome === "string" &&
    (no.nivel === "TAREFA" || no.nivel === "SUBTAREFA") &&
    ["responsavel", "prazo", "origemPerguntaCodigo", "origemValor"].every((chave) => textoOpcional(no[chave])) &&
    (no.manual === undefined || typeof no.manual === "boolean") &&
    escopoValido(no.children, profundidade + 1),
  );
}

function respostaValida(valor: unknown): valor is CondicaoValorState {
  if (typeof valor === "string") return true;
  return objeto(valor) && typeof valor.codigo === "string" &&
    ["sim", "nao", "a_avaliar"].includes(String(valor.aplicabilidade)) &&
    ["em_analise", "atendida", "pendente", "dispensada_com_fundamento"].includes(String(valor.situacao)) &&
    ["fundamento", "proximoPasso", "responsavel"].every((chave) => textoOpcional(valor[chave])) &&
    (valor.detalhes === undefined || (objeto(valor.detalhes) &&
      Object.values(valor.detalhes).every((item) => item === null || typeof item === "string" || (typeof item === "number" && Number.isFinite(item)))));
}

function dadosValidos(valor: unknown): valor is RascunhoProjeto {
  return objeto(valor) &&
    CAMPOS_TEXTO.every((chave) => typeof valor[chave] === "string") &&
    typeof valor.step === "number" && Number.isInteger(valor.step) && valor.step >= 0 &&
    Array.isArray(valor.secretariasCorrelatas) && valor.secretariasCorrelatas.every((id: unknown) => typeof id === "string") &&
    objeto(valor.respostas) && Object.values(valor.respostas).every(respostaValida) &&
    escopoValido(valor.escopo) &&
    (valor.impedimentosPersonalizados === undefined || (
      Array.isArray(valor.impedimentosPersonalizados) &&
      valor.impedimentosPersonalizados.length <= LIMITE_IMPEDIMENTOS_PERSONALIZADOS &&
      valor.impedimentosPersonalizados.every((item: unknown) => objeto(item) &&
        typeof item.codigo === "string" && CODIGO_IMPEDIMENTO_PERSONALIZADO.test(item.codigo) &&
        typeof item.nome === "string" && item.nome.length <= 200 &&
        (item.tipo === "IMPEDIMENTO" || item.tipo === "PRE_REQUISITO") &&
        typeof item.descricao === "string" && item.descricao.length <= 2000 && typeof item.bloqueante === "boolean") &&
      new Set(valor.impedimentosPersonalizados.map((item) => item.codigo)).size === valor.impedimentosPersonalizados.length
    ));
}

export function chaveRascunho(usuarioId: string, municipioId: string, classificacao: string) {
  if (!usuarioId || !municipioId || !classificacao) throw new Error("Contexto do rascunho incompleto.");
  return `cip:rascunho-projeto:v1:${[usuarioId, municipioId, classificacao].map(encodeURIComponent).join(":")}`;
}

export function lerRascunho(storage: Pick<Storage, "getItem">, chave: string): RascunhoProjeto | null {
  const texto = storage.getItem(chave);
  if (texto === null) return null;
  const registro: unknown = JSON.parse(texto);
  if (!objeto(registro) || registro.versao !== 1 || !dadosValidos(registro.dados)) {
    throw new Error("O rascunho salvo é incompatível ou está danificado. Ele não foi sobrescrito.");
  }
  return registro.dados;
}

export function salvarRascunho(storage: Pick<Storage, "setItem">, chave: string, dados: RascunhoProjeto) {
  // Lista explícita: nunca serializar o token nem outros estados do componente.
  const campos = Object.fromEntries(CAMPOS_TEXTO.map((campo) => [campo, dados[campo]]));
  storage.setItem(chave, JSON.stringify({
    versao: 1,
    atualizadoEm: new Date().toISOString(),
    dados: { ...campos, step: dados.step, respostas: dados.respostas, secretariasCorrelatas: dados.secretariasCorrelatas, escopo: dados.escopo, impedimentosPersonalizados: dados.impedimentosPersonalizados },
  }));
}
