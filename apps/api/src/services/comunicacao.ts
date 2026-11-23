import { prisma, type Prisma } from "@cip/db";
import { z } from "zod";
import { iniciativaScopeFilter, type AuthUser } from "../middleware/auth";
import { HttpError } from "../middleware/error";

const isSecretariaRole = (role: string) => role === "gestor";

export const paginaComunicacaoSchema = z.object({
  cursor: z.string().max(1000).optional(),
  limite: z.coerce.number().int().min(1).max(50).default(30),
  naoLidos: z.enum(["0", "1"]).optional(),
});

const cursorSchema = z.object({
  createdAt: z.string().datetime(),
  id: z.string().min(1).max(200),
  origem: z.enum(["comunicado", "notificacao", "projeto"]),
});
export type CursorComunicacao = z.infer<typeof cursorSchema>;

export function decodeCursor(value?: string): CursorComunicacao | undefined {
  if (!value) return;
  try {
    return cursorSchema.parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
  } catch {
    throw new HttpError(400, "INVALID_CURSOR", "Página inválida. Atualize a lista para continuar.");
  }
}

export function encodeCursor(item: { id: string; createdAt: Date | string; origem: CursorComunicacao["origem"] }) {
  return Buffer.from(JSON.stringify({ ...item, createdAt: new Date(item.createdAt).toISOString() })).toString("base64url");
}

/** A mesma ordenação é usada nas duas fontes, inclusive em empates de data. */
export function antesDoCursor(cursor: CursorComunicacao | undefined, origem: CursorComunicacao["origem"]) {
  if (!cursor) return {};
  const createdAt = new Date(cursor.createdAt);
  return { OR: [
    { createdAt: { lt: createdAt } },
    ...(origem < cursor.origem ? [{ createdAt }] : origem === cursor.origem
      ? [{ createdAt, id: { lt: cursor.id } }] : []),
  ] };
}

export function projetoScope(user: AuthUser): Prisma.IniciativaWhereInput {
  return { municipioId: user.municipioId, AND: [iniciativaScopeFilter(user)] };
}

export function comunicadoScope(user: AuthUser): Prisma.ComunicadoWhereInput {
  return { iniciativa: projetoScope(user) };
}

export function recebidosScope(user: AuthUser): Prisma.ComunicadoWhereInput {
  return {
    AND: [
      comunicadoScope(user),
      { OR: [{ destinatarioId: user.id }, { destinoPapel: user.role }] },
      { OR: [{ autorId: null }, { autorId: { not: user.id } }] },
    ],
  };
}

/** Destinar um aviso não concede acesso: o vínculo atual precisa permitir abrir o projeto. */
export function destinatariosWhere(user: AuthUser, projeto: { secretariaPrincipalId: string; secretarias: { secretariaId: string }[] }): Prisma.UserWhereInput {
  const secretarias = [projeto.secretariaPrincipalId, ...projeto.secretarias.map((s) => s.secretariaId)];
  return {
    active: true,
    id: { not: user.id },
    vinculos: { some: { municipioId: user.municipioId, OR: [
      { roleCode: { in: ["analista", "prefeito"] } },
      { roleCode: { in: ["gestor"] }, secretariaId: { in: secretarias }, secretaria: { active: true } },
      { roleCode: "admin", user: { isPlatformAdmin: true } },
    ] } },
  };
}

/** As notificações legadas usam alvos polimórficos. Resolver IDs sem carregar seu texto
 * permite revogar o conteúdo quando o usuário perde acesso à pasta/projeto. */
export async function notificacaoScope(user: AuthUser): Promise<Prisma.NotificacaoWhereInput> {
  const projeto = projetoScope(user);
  const [projetos, marcos, subtarefas, metas, indicadores] = await Promise.all([
    prisma.iniciativa.findMany({ where: projeto, select: { id: true } }),
    prisma.marcoEntrega.findMany({ where: { iniciativa: projeto }, select: { id: true } }),
    prisma.subtarefa.findMany({ where: { marco: { iniciativa: projeto } }, select: { id: true } }),
    prisma.metaEstrategica.findMany({ where: {
      plano: { municipioId: user.municipioId },
      ...(isSecretariaRole(user.role) ? { OR: [
        { secretariaId: user.secretariaId || "" }, { iniciativas: { some: projeto } },
      ] } : {}),
    }, select: { id: true } }),
    prisma.indicador.findMany({ where: {
      municipioId: user.municipioId,
      ...(isSecretariaRole(user.role) ? { OR: [
        { metaExecucao: { iniciativa: projeto } },
        { metaEstrategica: { OR: [{ secretariaId: user.secretariaId || "" }, { iniciativas: { some: projeto } }] } },
      ] } : {}),
    }, select: { id: true } }),
  ]);
  const ids = (rows: { id: string }[]) => rows.map((row) => row.id);
  const alvos = [
    { entidadeTipo: "INICIATIVA", entidadeId: { in: ids(projetos) } },
    { entidadeTipo: "MARCO", entidadeId: { in: ids(marcos) } },
    { entidadeTipo: "SUBTAREFA", entidadeId: { in: ids(subtarefas) } },
    { entidadeTipo: "META_ESTRATEGICA", entidadeId: { in: ids(metas) } },
    { entidadeTipo: "INDICADOR", entidadeId: { in: ids(indicadores) } },
  ];
  const solicitacoes = await prisma.solicitacaoValidacao.findMany({
    where: { municipioId: user.municipioId, OR: alvos }, select: { id: true },
  });
  return { userId: user.id, municipioId: user.municipioId, OR: [
    ...alvos, { entidadeTipo: "SOLICITACAO", entidadeId: { in: ids(solicitacoes) } },
  ] };
}

export const comunicadoInclude = (userId: string) => ({
  autor: { select: { id: true, name: true } },
  destinatario: { select: { id: true, name: true } },
  iniciativa: { select: { id: true, nome: true, secretariaPrincipal: { select: { nome: true } } } },
  leituras: { where: { userId } },
}) satisfies Prisma.ComunicadoInclude;

export function mensagemRecebida(item: { autorId: string | null; destinatarioId: string | null; destinoPapel: string | null }, user: AuthUser) {
  return item.autorId !== user.id && (item.destinatarioId === user.id || item.destinoPapel === user.role);
}
