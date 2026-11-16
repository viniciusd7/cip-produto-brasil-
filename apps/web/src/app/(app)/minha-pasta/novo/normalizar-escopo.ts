import type { EscopoNo } from "./escopo-editor";

export type NoApi = {
  codigo: string;
  nivel: string;
  nome: string;
  responsavel?: string | null;
  prazo?: string | null;
  origemPerguntaCodigo?: string | null;
  origemValor?: string | null;
  children?: NoApi[];
};

/** Modelos antigos podem agrupar tarefas sob metas; apenas as tarefas são editáveis. */
export function normalizarEscopo(nos: NoApi[]): EscopoNo[] {
  return nos.flatMap((n): EscopoNo[] => {
    if (n.nivel !== "TAREFA") return normalizarEscopo(n.children ?? []);
    return [{
      codigo: n.codigo,
      nivel: "TAREFA",
      nome: n.nome,
      responsavel: n.responsavel ?? null,
      prazo: n.prazo ?? null,
      origemPerguntaCodigo: n.origemPerguntaCodigo ?? null,
      origemValor: n.origemValor ?? null,
      manual: false,
      children: (n.children ?? []).filter((sub) => sub.nivel === "SUBTAREFA").map((sub) => ({
        codigo: sub.codigo,
        nivel: "SUBTAREFA",
        nome: sub.nome,
        responsavel: sub.responsavel ?? null,
        prazo: sub.prazo ?? null,
        origemPerguntaCodigo: sub.origemPerguntaCodigo ?? null,
        origemValor: sub.origemValor ?? null,
        manual: false,
        children: [],
      })),
    }];
  });
}
