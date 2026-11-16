import { Prisma, prisma } from "@cip/db";
import { z } from "zod";
import { iniciativaScopeFilter, type AuthUser } from "../middleware/auth";
import { HttpError } from "../middleware/error";
import { writeAudit } from "./audit";

const nomeSchema = z.string().trim().min(3).max(191);
const descricaoSchema = z.string().trim().max(10000).optional();
const textoIndicadorSchema = z.string().trim().max(191).optional();

export const metaProjetoSchema = z.object({
  nome: nomeSchema,
  descricao: descricaoSchema,
  planoId: z.string().trim().min(1).max(191).optional(),
}).strict();

export const indicadorProjetoSchema = z.object({
  nome: nomeSchema,
  descricao: descricaoSchema,
  unidade: textoIndicadorSchema,
  valorBase: textoIndicadorSchema,
  alvo: textoIndicadorSchema,
  valorAtual: textoIndicadorSchema,
  periodicidade: textoIndicadorSchema,
}).strict();

const indicadorSelect = {
  id: true,
  nome: true,
  descricao: true,
  unidade: true,
  valorBase: true,
  alvo: true,
  valorAtual: true,
  periodicidade: true,
} satisfies Prisma.IndicadorSelect;

async function carregarProjeto(
  client: Pick<Prisma.TransactionClient, "iniciativa">,
  user: AuthUser,
  id: string,
) {
  const projeto = await client.iniciativa.findFirst({
    where: { id, municipioId: user.municipioId, AND: [iniciativaScopeFilter(user)] },
    select: {
      id: true,
      secretariaPrincipalId: true,
      metaEstrategicaId: true,
      metaEstrategica: {
        select: {
          id: true,
          nome: true,
          descricao: true,
          plano: { select: { municipioId: true } },
          indicadores: {
            where: { municipioId: user.municipioId, metaExecucaoId: null },
            select: indicadorSelect,
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          },
        },
      },
    },
  });
  if (!projeto) throw new HttpError(404, "NOT_FOUND", "Projeto não encontrado");
  if (projeto.metaEstrategica && projeto.metaEstrategica.plano.municipioId !== user.municipioId) {
    throw new HttpError(409, "INVALID_META", "A meta vinculada não pertence ao município do projeto");
  }
  return projeto;
}

export async function lerEstrategiaProjeto(user: AuthUser, id: string) {
  const projeto = await carregarProjeto(prisma, user, id);
  if (!projeto.metaEstrategica) return { meta: null };
  const { plano, ...meta } = projeto.metaEstrategica;
  return { meta };
}

function listarPlanos(client: Pick<Prisma.TransactionClient, "planoGoverno">, municipioId: string) {
  return client.planoGoverno.findMany({
    where: { municipioId },
    select: { id: true, nome: true, periodo: true, mandatoInicio: true, mandatoFim: true },
    orderBy: [{ nome: "asc" }, { id: "asc" }],
  });
}

export async function listarPlanosEstrategiaProjeto(user: AuthUser, id: string) {
  await carregarProjeto(prisma, user, id);
  const planos = await listarPlanos(prisma, user.municipioId);
  return { planos, selecaoObrigatoria: planos.length > 1 };
}

async function transacionar<T>(run: (tx: Prisma.TransactionClient) => Promise<T>) {
  try {
    return await prisma.$transaction(run, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      throw new HttpError(
        409,
        "ESTRATEGIA_CONCURRENT_UPDATE",
        "A estratégia foi alterada simultaneamente. Recarregue o projeto e tente novamente",
      );
    }
    throw error;
  }
}

export async function criarMetaProjeto(
  user: AuthUser,
  id: string,
  body: z.infer<typeof metaProjetoSchema>,
  ip?: string,
) {
  return transacionar(async (tx) => {
    const projeto = await carregarProjeto(tx, user, id);
    if (projeto.metaEstrategicaId) {
      throw new HttpError(409, "META_ESTRATEGICA_EXISTS", "O projeto já possui uma meta estratégica");
    }
    const agora = new Date();
    const planos = await listarPlanos(tx, user.municipioId);
    if (body.planoId && !planos.some((plano) => plano.id === body.planoId)) {
      throw new HttpError(422, "INVALID_PLANO", "O plano selecionado não existe ou não pertence ao município do projeto");
    }
    if (!planos.length) {
      throw new HttpError(
        409,
        "PLANO_GOVERNO_REQUIRED",
        "Cadastre um plano de governo neste município antes de criar a meta",
      );
    }
    if (!body.planoId && planos.length > 1) {
      throw new HttpError(
        409,
        "PLANO_SELECTION_REQUIRED",
        "Há múltiplos planos neste município. Consulte a lista de planos do projeto e informe planoId",
      );
    }
    const planoId = body.planoId ?? planos[0].id;
    const meta = await tx.metaEstrategica.create({
      data: { nome: body.nome, descricao: body.descricao, planoId, secretariaId: projeto.secretariaPrincipalId },
      select: { id: true, nome: true, descricao: true },
    });
    const vinculo = await tx.iniciativa.updateMany({
      where: { id, municipioId: user.municipioId, metaEstrategicaId: null },
      data: { metaEstrategicaId: meta.id, atualizadoEm: agora },
    });
    if (vinculo.count !== 1) {
      throw new HttpError(409, "META_ESTRATEGICA_EXISTS", "O projeto já possui uma meta estratégica ou foi alterado");
    }
    await writeAudit({
      user, action: "CREATE", entity: "MetaEstrategica", entityId: meta.id,
      after: { ...meta, planoId, secretariaId: projeto.secretariaPrincipalId, iniciativaId: id }, ip,
    }, tx);
    await writeAudit({
      user, action: "UPDATE", entity: "Iniciativa", entityId: id,
      before: { metaEstrategicaId: null }, after: { metaEstrategicaId: meta.id }, ip,
    }, tx);
    return { meta: { ...meta, indicadores: [] } };
  });
}

export async function criarIndicadorProjeto(
  user: AuthUser,
  id: string,
  body: z.infer<typeof indicadorProjetoSchema>,
  ip?: string,
) {
  return transacionar(async (tx) => {
    const projeto = await carregarProjeto(tx, user, id);
    if (!projeto.metaEstrategicaId) {
      throw new HttpError(409, "META_ESTRATEGICA_REQUIRED", "Cadastre a meta estratégica do projeto antes de adicionar indicadores");
    }
    const vinculo = await tx.iniciativa.updateMany({
      where: { id, municipioId: user.municipioId, metaEstrategicaId: projeto.metaEstrategicaId },
      data: { atualizadoEm: new Date() },
    });
    if (vinculo.count !== 1) {
      throw new HttpError(409, "ESTRATEGIA_CONCURRENT_UPDATE", "O vínculo da meta foi alterado. Recarregue o projeto");
    }
    // Inclui outros municípios: vínculos legados inconsistentes também impedem a escrita.
    const compartilhada = await tx.iniciativa.count({
      where: { metaEstrategicaId: projeto.metaEstrategicaId, id: { not: id } },
    });
    if (compartilhada > 0) {
      throw new HttpError(
        409,
        "META_ESTRATEGICA_SHARED",
        "A meta é compartilhada com outros projetos. Não é possível adicionar um indicador exclusivo por esta rota",
      );
    }
    const indicador = await tx.indicador.create({
      data: { ...body, municipioId: user.municipioId, metaEstrategicaId: projeto.metaEstrategicaId },
      select: indicadorSelect,
    });
    await writeAudit({
      user, action: "CREATE", entity: "Indicador", entityId: indicador.id,
      after: { ...indicador, iniciativaId: id, metaEstrategicaId: projeto.metaEstrategicaId }, ip,
    }, tx);
    return indicador;
  });
}
