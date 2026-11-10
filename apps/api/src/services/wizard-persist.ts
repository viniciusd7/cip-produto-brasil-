import { prisma } from "@cip/db";
import type { ModeloSnapshot, TreeNode } from "@cip/shared";

export async function loadModeloSnapshot(modeloId: string): Promise<ModeloSnapshot> {
  const modelo = await prisma.modeloProjeto.findUnique({
    where: { id: modeloId },
    include: { perguntas: true, estrutura: true },
  });
  if (!modelo) throw new Error("MODELO_NOT_FOUND");

  const snap = modelo.snapshot as ModeloSnapshot | null;
  if (snap?.perguntas?.length && snap?.estrutura?.length) {
    return snap;
  }

  const idToCodigo = new Map(modelo.perguntas.map((p) => [p.id, p.codigo]));
  return {
    codigo: modelo.codigo,
    nome: modelo.nome,
    perguntas: modelo.perguntas.map((p) => ({
      codigo: p.codigo,
      texto: p.texto,
      tipoResposta: p.tipoResposta as ModeloSnapshot["perguntas"][0]["tipoResposta"],
      impacto: p.impacto as ModeloSnapshot["perguntas"][0]["impacto"],
      obrigatoria: p.obrigatoria,
      ordem: p.ordem,
      dependeDeCodigo: p.dependeDePerguntaId
        ? idToCodigo.get(p.dependeDePerguntaId) || null
        : null,
      dependeDeValor:
        (p.dependeDeValor as ModeloSnapshot["perguntas"][0]["dependeDeValor"]) ??
        null,
      opcoes: (p.opcoes as string[] | null) ?? null,
      efeitos: (p.efeitos as ModeloSnapshot["perguntas"][0]["efeitos"]) || [],
    })),
    estrutura: modelo.estrutura.map((e) => ({
      codigo: e.codigo,
      nivel: e.nivel as "META" | "TAREFA" | "SUBTAREFA",
      parentCodigo: e.parentCodigo,
      nome: e.nome,
      indicador: e.indicador,
      alvo: e.alvo,
      ordem: e.ordem,
      sempreIncluir: e.sempreIncluir,
    })),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbClient = { metaExecucao: any; marcoEntrega: any; subtarefa: any; itemGeradoOrigem: any };

export async function persistTree(
  iniciativaId: string,
  nodes: TreeNode[],
  tx: DbClient = prisma,
) {
  async function walk(
    list: TreeNode[],
    parentMetaId?: string,
    parentMarcoId?: string,
  ) {
    for (const node of list) {
      if (node.nivel === "META") {
        const meta = await tx.metaExecucao.create({
          data: {
            iniciativaId,
            codigo: node.codigo,
            nome: node.nome,
            indicador: node.indicador || undefined,
            alvo: node.alvo || undefined,
            responsavel: node.responsavel || undefined,
          },
        });
        if (node.origemPerguntaCodigo) {
          await tx.itemGeradoOrigem.create({
            data: {
              iniciativaId,
              metaExecucaoId: meta.id,
              perguntaCodigo: node.origemPerguntaCodigo,
              valorQueGerou: node.origemValor,
              modeloEstruturaCodigo: node.codigo,
            },
          });
        }
        await walk(node.children, meta.id);
      } else if (node.nivel === "TAREFA") {
        const prazo = node.prazo ? new Date(node.prazo) : null;
        const marco = await tx.marcoEntrega.create({
          data: {
            iniciativaId,
            metaExecucaoId: parentMetaId,
            codigo: node.codigo,
            descricao: node.nome,
            responsavel: node.responsavel || undefined,
            prazoOriginal: prazo,
            prazoVigente: prazo,
          },
        });
        if (node.origemPerguntaCodigo) {
          await tx.itemGeradoOrigem.create({
            data: {
              iniciativaId,
              marcoId: marco.id,
              perguntaCodigo: node.origemPerguntaCodigo,
              valorQueGerou: node.origemValor,
              modeloEstruturaCodigo: node.codigo,
            },
          });
        }
        await walk(node.children, parentMetaId, marco.id);
      } else if (parentMarcoId) {
        const st = await tx.subtarefa.create({
          data: {
            marcoId: parentMarcoId,
            descricao: node.nome,
            responsavel: node.responsavel || undefined,
          },
        });
        if (node.origemPerguntaCodigo) {
          await tx.itemGeradoOrigem.create({
            data: {
              iniciativaId,
              subtarefaId: st.id,
              perguntaCodigo: node.origemPerguntaCodigo,
              valorQueGerou: node.origemValor,
              modeloEstruturaCodigo: node.codigo,
            },
          });
        }
      }
    }
  }

  await walk(nodes);
}

export function assertExecucaoPermitida(ciclo: string) {
  if (ciclo === "AGUARDANDO_PRE_REQUISITO") {
    return false;
  }
  return true;
}
