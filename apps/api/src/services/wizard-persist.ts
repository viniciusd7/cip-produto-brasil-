import { prisma, type Prisma } from "@cip/db";
import { buildCatalogoPerguntas, etapasFromGrupos, type ModeloSnapshot, type TreeNode } from "@cip/shared";
import { HttpError } from "../middleware/error";

export async function loadModeloSnapshot(modeloId: string): Promise<ModeloSnapshot> {
  const modelo = await prisma.modeloProjeto.findUnique({
    where: { id: modeloId },
    include: { perguntas: true, estrutura: true },
  });
  if (!modelo) throw new Error("MODELO_NOT_FOUND");

  const snap = modelo.snapshot as ModeloSnapshot | null;
  if (snap?.perguntas?.length && snap?.estrutura?.length) {
    if (modelo.codigo === "PROJETO_ESTRUTURANTE_PADRAO") {
      return {
        ...snap,
        perguntas: buildCatalogoPerguntas(),
        etapas: etapasFromGrupos(),
        estrutura: snap.estrutura.map((item) => ({
          ...item,
          nome: item.codigo === "TAR_OBTER_DOTACAO" ? "Confirmar dotação e liberação da verba" : item.nome,
          // O catálogo anterior incluía etapas de licitação mesmo sem contratação.
          sempreIncluir: ["META_EXECUCAO", "META_OPERACAO", "TAR_ENTREGA"].includes(item.codigo),
        })),
      };
    }
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

type DbClient = Pick<Prisma.TransactionClient, "marcoEntrega" | "subtarefa" | "itemGeradoOrigem">;

export function validarArvoreTarefas(nodes: TreeNode[]) {
  function validar(list: TreeNode[], nivel: "TAREFA" | "SUBTAREFA") {
    for (const node of list) {
      if (node.nivel !== nivel || (nivel === "SUBTAREFA" && node.children.length)) {
        throw new HttpError(422, "ESCOPO_INVALIDO", "Use tarefas diretamente no projeto e subtarefas dentro de tarefas, sem metas de execução");
      }
      validar(node.children, "SUBTAREFA");
    }
  }
  validar(nodes, "TAREFA");
}

export async function persistTree(
  iniciativaId: string,
  nodes: TreeNode[],
  tx: DbClient = prisma,
) {
  validarArvoreTarefas(nodes);
  async function walk(
    list: TreeNode[],
    parentMarcoId?: string,
  ) {
    for (const [ordem, node] of list.entries()) {
      if (node.nivel === "TAREFA") {
        const prazo = node.prazo ? new Date(node.prazo) : null;
        const marco = await tx.marcoEntrega.create({
          data: {
            iniciativaId,
            codigo: node.codigo,
            ordem,
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
        await walk(node.children, marco.id);
      } else if (parentMarcoId) {
        const st = await tx.subtarefa.create({
          data: {
            marcoId: parentMarcoId,
            descricao: node.nome,
            responsavel: node.responsavel || undefined,
            prazo: node.prazo ? new Date(node.prazo) : null,
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
