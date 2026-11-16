import { z } from "zod";
import {
  CARRETAS_ETAPAS,
  CARRETAS_FICHA_CAMPOS,
  CARRETAS_GATES,
  CARRETAS_INDICADORES,
  CARRETAS_ORCAMENTO,
  CARRETAS_POPS,
  CARRETAS_PRESTACAO,
  CARRETAS_RISCOS,
  criarCarretasDossiePadrao,
} from "@cip/shared";

const texto = z.string().max(4000);
const dataOpcional = z.string().refine((value) => {
  if (value === "") return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}, "Informe uma data válida ou deixe o campo vazio");
const decimalOpcional = (casasDecimais: number) =>
  z.string().refine(
    (value) => {
      if (value === "") return true;
      const match = /^(?:0|[1-9]\d{0,14})(?:[.,](\d+))?$/.exec(value);
      return Boolean(match && (match[1]?.length ?? 0) <= casasDecimais);
    },
    `Informe um número não negativo com até ${casasDecimais} casas decimais, sem símbolos, ou deixe vazio`,
  );

function codigosExatos<T extends { codigo: string }>(expected: readonly T[]) {
  return <S extends z.ZodType<{ codigo: string }>>(schema: S) =>
    z.array(schema).length(expected.length).superRefine((rows, context) => {
      expected.forEach((item, index) => {
        if (rows[index]?.codigo !== item.codigo) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [index, "codigo"],
            message: `Esperado ${item.codigo} nesta posição`,
          });
        }
      });
    });
}

const criterioSchema = z.object({
  codigo: z.string().min(1).max(80),
  situacao: z.enum(["PENDENTE", "ATENDIDO", "NAO_APLICAVEL", "BLOQUEADO"]),
  responsavel: texto,
  evidencia: texto,
  ajusteLocal: texto,
}).strict();

const gateSchema = z.object({
  codigo: z.string().min(1).max(20),
  situacao: z.enum(["PENDENTE", "EM_ANALISE", "APROVADO", "APROVADO_COM_CORRECOES", "NAO_APROVADO"]),
  decisao: z.enum(["", "APROVADO", "APROVADO_COM_CORRECOES", "NAO_APROVADO"]),
  autoridade: texto,
  dataDecisao: dataOpcional,
  correcao: texto,
  criterios: z.array(criterioSchema).min(1).max(10),
}).strict().superRefine((gate, context) => {
  if (gate.decisao) {
    if (!gate.autoridade.trim()) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["autoridade"], message: "Identifique a autoridade da decisão" });
    }
    if (!gate.dataDecisao) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["dataDecisao"], message: "Informe a data da decisão" });
    }
    if (gate.situacao !== gate.decisao) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["situacao"], message: "Situação e decisão do portão devem coincidir" });
    }
  }
  for (const [index, criterio] of gate.criterios.entries()) {
    if (criterio.situacao === "ATENDIDO" && (!criterio.responsavel.trim() || !criterio.evidencia.trim())) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["criterios", index],
        message: "Critério atendido precisa de responsável e evidência",
      });
    }
    if (criterio.situacao === "NAO_APLICAVEL" && !criterio.ajusteLocal.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["criterios", index, "ajusteLocal"],
        message: "Justifique por que o critério não se aplica",
      });
    }
  }
  if (
    gate.decisao === "APROVADO" &&
    gate.criterios.some((criterio) => criterio.situacao !== "ATENDIDO" && criterio.situacao !== "NAO_APLICAVEL")
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["criterios"],
      message: "Não aprove o portão enquanto houver critério pendente ou bloqueado",
    });
  }
  if (gate.decisao === "APROVADO_COM_CORRECOES" && !gate.correcao.trim()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["correcao"],
      message: "Registre as correções, responsáveis e condição de passagem",
    });
  }
});

export const carretasDossieSchema = z.object({
  versao: z.literal(1),
  statusDemonstracao: z.literal("EM_VALIDACAO_CLIENTE"),
  ficha: z.record(z.string(), texto).superRefine((fields, context) => {
    const allowed = new Set(CARRETAS_FICHA_CAMPOS.map((field) => field.codigo));
    for (const key of Object.keys(fields)) {
      if (!allowed.has(key)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: "Campo não reconhecido",
        });
      }
    }
    for (const key of allowed) {
      if (!(key in fields)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: "Campo obrigatório no dossiê",
        });
      }
    }
    const date = fields.dataD0;
    if (date && !dataOpcional.safeParse(date).success) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dataD0"],
        message: "Informe uma data válida ou deixe o campo vazio",
      });
    }
  }),
  gates: codigosExatos(CARRETAS_GATES)(gateSchema).superRefine((gates, context) => {
    gates.forEach((gate, index) => {
      const expected = CARRETAS_GATES[index]!.criterios.map(([codigo]) => codigo);
      if (
        gate.criterios.length !== expected.length ||
        gate.criterios.some((item, i) => item.codigo !== expected[i])
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "criterios"],
          message: "A lista de critérios do portão não corresponde ao modelo",
        });
      }
    });
  }),
  cronograma: codigosExatos(CARRETAS_ETAPAS)(
    z.object({
      codigo: z.string().min(1).max(80),
      situacao: z.enum(["PENDENTE", "EM_ANDAMENTO", "CONCLUIDO", "BLOQUEADO"]),
      responsavel: texto,
      inicioRelativo: z.string().max(120),
      duracao: z.string().max(120),
      evidencia: texto,
    }).strict(),
  ),
  orcamento: codigosExatos(CARRETAS_ORCAMENTO)(
    z.object({
      codigo: z.string().min(1).max(80),
      valor: decimalOpcional(2),
      memoriaCalculo: texto,
      pagador: texto,
      fonteRecurso: texto,
      documento: texto,
      responsavel: texto,
      situacao: z.enum(["A_DEFINIR", "EM_VALIDACAO", "VALIDADO", "BLOQUEADO"]),
    }).strict(),
  ).superRefine((items, context) => {
    items.forEach((item, index) => {
      if (
        item.situacao === "VALIDADO" &&
        (!item.valor || !item.pagador.trim() || !item.fonteRecurso.trim() || !item.documento.trim())
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index],
          message: "Custo validado exige valor, pagador, fonte e documento",
        });
      }
    });
  }),
  riscos: codigosExatos(CARRETAS_RISCOS)(
    z.object({
      codigo: z.string().min(1).max(20),
      situacao: z.enum(["MONITORAR", "ACONTECEU", "MITIGADO", "ENCERRADO"]),
      prevencaoLocal: texto,
      gatilhoLocal: texto,
      respostaLocal: texto,
      responsavel: texto,
      evidenciaControle: texto,
      acaoLocal: texto,
      revisadoEm: dataOpcional,
    }).strict(),
  ).superRefine((risks, context) => {
    risks.forEach((risk, index) => {
      if (
        ["ACONTECEU", "MITIGADO", "ENCERRADO"].includes(risk.situacao) &&
        (!risk.responsavel.trim() || !risk.evidenciaControle.trim() || !risk.acaoLocal.trim())
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index],
          message: "Ocorrência, mitigação ou encerramento exige responsável, evidência e ação",
        });
      }
    });
  }),
  indicadores: codigosExatos(CARRETAS_INDICADORES)(
    z.object({
      codigo: z.string().min(1).max(80),
      formulaLocal: texto,
      unidadeAnalise: texto,
      limitacaoLocal: texto,
      linhaBase: decimalOpcional(4),
      meta: decimalOpcional(4),
      aprovacaoMeta: texto,
      valorAtual: decimalOpcional(4),
      dataCorte: dataOpcional,
      fonteLocal: texto,
      responsavelLocal: texto,
      faixaAlerta: texto,
    }).strict(),
  ).superRefine((items, context) => {
    items.forEach((item, index) => {
      if (item.meta && !item.aprovacaoMeta.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "aprovacaoMeta"],
          message: "Meta quantitativa precisa de referência à aprovação local",
        });
      }
      if ((item.linhaBase || item.valorAtual) && (!item.dataCorte || !item.fonteLocal.trim())) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index],
          message: "Medição exige data de corte e fonte local",
        });
      }
    });
  }),
  pops: codigosExatos(CARRETAS_POPS)(
    z.object({
      codigo: z.string().min(1).max(20),
      situacao: z.enum(["PENDENTE", "EM_VALIDACAO", "VALIDADO", "NAO_APLICAVEL"]),
      responsavel: texto,
      evidencia: texto,
      excecaoLocal: texto,
      detalhesLocais: texto,
    }).strict(),
  ).superRefine((pops, context) => {
    pops.forEach((pop, index) => {
      if (pop.situacao === "VALIDADO" && (!pop.responsavel.trim() || !pop.evidencia.trim())) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index],
          message: "POP validado exige responsável e evidência",
        });
      }
      if (pop.situacao === "NAO_APLICAVEL" && !pop.detalhesLocais.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "detalhesLocais"],
          message: "Justifique por que o POP não se aplica",
        });
      }
    });
  }),
  prestacao: codigosExatos(CARRETAS_PRESTACAO)(
    z.object({
      codigo: z.string().min(1).max(80),
      situacao: z.enum(["PENDENTE", "EM_VALIDACAO", "VALIDADO", "NAO_APLICAVEL"]),
      responsavel: texto,
      evidencia: texto,
      observacao: texto,
    }).strict(),
  ).superRefine((items, context) => {
    items.forEach((item, index) => {
      if (item.situacao === "VALIDADO" && (!item.responsavel.trim() || !item.evidencia.trim())) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index],
          message: "Prestação validada exige responsável e evidência",
        });
      }
      if (item.situacao === "NAO_APLICAVEL" && !item.observacao.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "observacao"],
          message: "Justifique por que o item não se aplica",
        });
      }
    });
  }),
  decisaoPiloto: z.object({
    resultado: z.enum(["", "ESCALAR_COM_CONDICOES", "CORRIGIR_E_REPETIR", "NAO_EXPANDIR", "ADOTAR_ALTERNATIVA"]),
    justificativa: texto,
    pendencias: texto,
    autoridade: texto,
    data: dataOpcional,
  }).strict().superRefine((decision, context) => {
    if (decision.resultado && !decision.justificativa.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["justificativa"],
        message: "Registre a justificativa da decisão",
      });
    }
    if (decision.resultado && !decision.autoridade.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["autoridade"],
        message: "Identifique a autoridade competente",
      });
    }
    if (decision.resultado && !decision.data) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["data"],
        message: "Informe a data da decisão",
      });
    }
  }),
}).strict();

export const salvarCarretasDossieSchema = z.object({
  revision: z.number().int().min(0),
  dossie: carretasDossieSchema,
}).strict();

export type CarretasDossieValidado = z.infer<typeof carretasDossieSchema>;
export const carretasDossiePadrao = criarCarretasDossiePadrao;
