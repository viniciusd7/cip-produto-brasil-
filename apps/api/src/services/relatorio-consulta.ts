import { z } from "zod";
import { numeroIndicador } from "./indicadores";

export const consultaRelatorioSchema = z.object({
  tipo: z.enum(["tarefas", "metas", "projetos", "secretarias", "evidencias"]).default("tarefas"),
  busca: z.string().trim().max(200).default(""),
  ordenar: z.string().max(40).optional(),
  direcao: z.enum(["asc", "desc"]).default("asc"),
  status: z.string().optional(),
}).superRefine((valor, ctx) => {
  if (valor.status && (valor.tipo === "metas" || valor.tipo === "evidencias")) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["status"], message: "Situação de tarefas não se aplica a metas estratégicas ou evidências." });
  }
});

export type ConsultaFiltros = z.infer<typeof consultaRelatorioSchema>;
type Valor = string | number | null;
type Coluna = { chave: string; rotulo: string };
type Linha = { id: string; valores: Record<string, Valor> };

type Dados = {
  tarefas: Array<{
    id: string; codigo?: string | null; descricao: string; responsavel?: string | null;
    secretaria: string; projetoCodigo: string; projetoNome: string; status: string;
    prazo: string | null; prazoOriginal: string | null; concluidoEm: string | null;
    reprogramacoes: number; subtarefas: { feitas: number; total: number };
    evidencias: { total: number; aprovadas: number };
  }>;
  metasEstrategicas: Array<{
    id: string; nome: string; secretaria: string | null; base: string | null;
    realizado: string | null; alvo: string | null; unidade: string | null; dataCorte: string | null;
    projetos: Array<{ codigo: string; nome: string }>;
    indicadores: Array<{
      id: string; nome: string; unidade: string | null; valorBase: string | null;
      valorAtual: string | null; alvo: string | null; periodicidade: string | null;
      medicao: { valorRealizado: string; dataCorte: string } | null;
    }>;
  }>;
  projetos: Array<{
    id: string; codigo: string; nome: string; secretaria: string; total: number;
    concluidas: number; noPrazo: number; semPrazo: number; atrasadas: number;
  }>;
  porSecretaria: Array<{
    id: string; nome: string; sigla: string | null; projetos: number; total: number;
    concluidas: number; noPrazo: number; semPrazo: number; atrasadas: number;
  }>;
  evidenciasDetalhadas: Array<{
    id: string; secretaria: string; projeto: string; tipo: string; status: string; criadaEm: string;
  }>;
};

const SITUACAO: Record<string, string> = {
  CONCLUIDO: "Concluída", NO_PRAZO: "No prazo", SEM_PRAZO: "Sem prazo", VENCIDO: "Atrasada",
  ENCERRADO_SEM_SOLUCAO: "Encerrada sem solução",
};

function dia(iso: string | null) {
  return iso ? iso.slice(0, 10) : null;
}

function colunas(definicoes: Array<[string, string]>): Coluna[] {
  return definicoes.map(([chave, rotulo]) => ({ chave, rotulo }));
}

const CONTAGENS: Array<[string, string]> = [
  ["total", "Tarefas"], ["concluidas", "Concluídas"], ["noPrazo", "No prazo"],
  ["semPrazo", "Sem prazo"], ["atrasadas", "Atrasadas"],
];

export function consultarRelatorio(dados: Dados, filtros: ConsultaFiltros) {
  let campos: Coluna[];
  let linhas: Linha[];
  switch (filtros.tipo) {
    case "tarefas":
      campos = colunas([
        ["secretaria", "Secretaria"], ["projeto", "Projeto"], ["codigo", "Código"],
        ["tarefa", "Tarefa"], ["responsavel", "Responsável"], ["situacao", "Situação"],
        ["prazo", "Prazo"], ["prazoOriginal", "Prazo original"], ["entrega", "Concluída em"],
        ["reprogramacoes", "Reprogramações"], ["subtarefas", "Subtarefas feitas"],
        ["evidencias", "Evidências"], ["aprovadas", "Evidências aprovadas"],
      ]);
      linhas = dados.tarefas.map((t) => ({
        id: t.id,
        valores: {
          secretaria: t.secretaria, projeto: `${t.projetoCodigo} · ${t.projetoNome}`,
          codigo: t.codigo ?? null, tarefa: t.descricao, responsavel: t.responsavel ?? null,
          situacao: SITUACAO[t.status] ?? t.status, prazo: dia(t.prazo),
          prazoOriginal: dia(t.prazoOriginal), entrega: dia(t.concluidoEm),
          reprogramacoes: t.reprogramacoes, subtarefas: `${t.subtarefas.feitas}/${t.subtarefas.total}`,
          evidencias: t.evidencias.total, aprovadas: t.evidencias.aprovadas,
        },
      }));
      break;
    case "metas":
      campos = colunas([
        ["meta", "Meta estratégica"], ["secretaria", "Secretaria"], ["projetos", "Projetos vinculados"],
        ["indicador", "Indicador"], ["unidade", "Unidade"], ["base", "Base"],
        ["atual", "Atual cadastrado"], ["alvo", "Alvo"], ["periodicidade", "Periodicidade"],
        ["medicao", "Última medição no período"], ["dataMedicao", "Data da medição"],
      ]);
      linhas = dados.metasEstrategicas.flatMap((m) => {
        const comum = {
          meta: m.nome, secretaria: m.secretaria,
          projetos: m.projetos.map((p) => `${p.codigo} · ${p.nome}`).join("; "),
        };
        return m.indicadores.length
          ? m.indicadores.map((ind) => ({
              id: `${m.id}:${ind.id}`,
              valores: {
                ...comum, indicador: ind.nome, unidade: ind.unidade, base: ind.valorBase,
                atual: ind.valorAtual, alvo: ind.alvo, periodicidade: ind.periodicidade,
                medicao: ind.medicao?.valorRealizado ?? null, dataMedicao: dia(ind.medicao?.dataCorte ?? null),
              },
            }))
          : [{
              id: m.id,
              valores: {
                ...comum, indicador: "Sem indicador vinculado", unidade: m.unidade,
                base: m.base, atual: null, alvo: m.alvo, periodicidade: null,
                medicao: m.realizado, dataMedicao: dia(m.dataCorte),
              },
            }];
      });
      break;
    case "projetos":
      campos = colunas([["codigo", "Código"], ["nome", "Projeto"], ["secretaria", "Secretaria"], ...CONTAGENS]);
      linhas = dados.projetos.map((p) => ({ id: p.id, valores: {
        codigo: p.codigo, nome: p.nome, secretaria: p.secretaria, total: p.total,
        concluidas: p.concluidas, noPrazo: p.noPrazo, semPrazo: p.semPrazo, atrasadas: p.atrasadas,
      } }));
      break;
    case "secretarias":
      campos = colunas([["nome", "Secretaria"], ["sigla", "Sigla"], ["projetos", "Projetos"], ...CONTAGENS]);
      linhas = dados.porSecretaria.map((s) => ({ id: s.id, valores: {
        nome: s.nome, sigla: s.sigla, projetos: s.projetos, total: s.total,
        concluidas: s.concluidas, noPrazo: s.noPrazo, semPrazo: s.semPrazo, atrasadas: s.atrasadas,
      } }));
      break;
    case "evidencias":
      campos = colunas([
        ["id", "Identificação"], ["secretaria", "Secretaria"], ["projeto", "Projeto"],
        ["tipo", "Tipo"], ["situacao", "Situação"], ["data", "Data de envio"],
      ]);
      linhas = dados.evidenciasDetalhadas.map((e) => ({ id: e.id, valores: {
        id: e.id, secretaria: e.secretaria, projeto: e.projeto,
        tipo: e.tipo, situacao: e.status, data: dia(e.criadaEm),
      } }));
      break;
  }
  const normalizar = (valor: string) => valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const busca = normalizar(filtros.busca);
  const filtradas = busca
    ? linhas.filter((linha) => campos.some((campo) => normalizar(String(linha.valores[campo.chave] ?? "")).includes(busca)))
    : linhas;
  const ordenar = filtros.ordenar ?? campos[0].chave;
  if (!campos.some((campo) => campo.chave === ordenar)) {
    throw new z.ZodError([{ code: "custom", path: ["ordenar"], message: "Coluna de ordenação inválida para este relatório" }]);
  }
  const collator = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });
  const decimal = ["base", "atual", "alvo", "medicao"].includes(ordenar);
  filtradas.sort((a, b) => {
    const va = a.valores[ordenar];
    const vb = b.valores[ordenar];
    if (va == null && vb != null) return 1;
    if (vb == null && va != null) return -1;
    const numeroA = decimal && typeof va === "string" ? numeroIndicador(va) : va;
    const numeroB = decimal && typeof vb === "string" ? numeroIndicador(vb) : vb;
    const comparacao = typeof numeroA === "number" && Number.isFinite(numeroA) && typeof numeroB === "number" && Number.isFinite(numeroB)
      ? numeroA - numeroB : collator.compare(String(va ?? ""), String(vb ?? ""));
    return (filtros.direcao === "desc" ? -comparacao : comparacao) || collator.compare(a.id, b.id);
  });
  return { tipo: filtros.tipo, busca: filtros.busca, ordenar, direcao: filtros.direcao, colunas: campos, linhas: filtradas, total: filtradas.length };
}

export function campoCsv(valor: Valor) {
  const texto = valor == null ? "" : String(valor);
  // Planilhas não devem executar valores textuais como fórmulas.
  const seguro = typeof valor === "string" && /^[\s]*[=+@-]/.test(texto) ? `'${texto}` : texto;
  return /[";\r\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

export function exportarConsultaCsv(consulta: ReturnType<typeof consultarRelatorio>) {
  return "\uFEFF" + [
    consulta.colunas.map((coluna) => campoCsv(coluna.rotulo)).join(";"),
    ...consulta.linhas.map((linha) => consulta.colunas.map((coluna) => campoCsv(linha.valores[coluna.chave] ?? null)).join(";")),
  ].join("\r\n");
}
