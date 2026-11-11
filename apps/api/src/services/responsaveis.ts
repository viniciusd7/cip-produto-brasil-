import { prisma, type Prisma } from "@cip/db";
import { HttpError } from "../middleware/error";
import { notificarUsuario } from "./notifications";

/**
 * Valida o usuário responsável dentro da prefeitura.
 * undefined = não alterar; null = remover; string = atribuir.
 */
export async function resolverResponsavel(
  municipioId: string,
  userId: string | null | undefined,
  db: Prisma.TransactionClient = prisma,
): Promise<{ id: string; name: string } | null | undefined> {
  if (userId === undefined) return undefined;
  if (userId === null || userId === "") return null;
  const user = await db.user.findFirst({
    where: {
      id: userId,
      active: true,
      vinculos: { some: { municipioId, roleCode: { in: ["gestor", "analista", "prefeito"] } } },
    },
    select: { id: true, name: true },
  });
  if (!user) {
    throw new HttpError(422, "INVALID_RESPONSAVEL", "O responsável precisa ser um usuário ativo desta prefeitura");
  }
  return user;
}

/** Campos Prisma de responsável: FK + texto legado com o nome, para telas antigas. */
export function camposResponsavel(user: { id: string; name: string } | null | undefined) {
  if (user === undefined) return {};
  return { responsavelUserId: user?.id ?? null, responsavel: user?.name ?? null };
}

export async function notificarAtribuicao(params: {
  municipioId: string;
  anteriorUserId?: string | null;
  novo: { id: string; name: string } | null | undefined;
  autorId?: string;
  entidadeTipo: string;
  entidadeId: string;
  rotulo: string;
  descricao: string;
  link: string;
}) {
  const { novo } = params;
  if (!novo || novo.id === params.anteriorUserId || novo.id === params.autorId) return;
  await notificarUsuario({
    municipioId: params.municipioId,
    userId: novo.id,
    tipo: "ATRIBUICAO",
    titulo: `Você é responsável por ${params.rotulo}`,
    texto: params.descricao,
    link: params.link,
    entidadeTipo: params.entidadeTipo,
    entidadeId: params.entidadeId,
  });
}

export async function listarResponsaveis(municipioId: string) {
  const vinculos = await prisma.vinculoUsuarioMunicipio.findMany({
    where: { municipioId, roleCode: { in: ["gestor", "analista", "prefeito"] }, user: { active: true } },
    select: {
      roleCode: true,
      secretaria: { select: { id: true, nome: true, sigla: true } },
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { user: { name: "asc" } },
  });
  return vinculos.map((v) => ({
    id: v.user.id,
    name: v.user.name,
    email: v.user.email,
    roleCode: v.roleCode,
    secretaria: v.secretaria,
  }));
}
