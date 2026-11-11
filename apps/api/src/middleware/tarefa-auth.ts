import type { NextFunction, Request, Response } from "express";
import { prisma } from "@cip/db";
import type { PermissionCode } from "@cip/shared";
import { assertIniciativaAccess, type AuthUser } from "./auth";
import { HttpError } from "./error";

const PERMISSION_BY_ACTION: Record<
  "ler" | "editar" | "validar",
  PermissionCode
> = {
  ler: "iniciativa:read",
  editar: "iniciativa:write",
  validar: "evidencia:validate",
};

export async function assertMarcoAccess(
  marcoId: string,
  user: AuthUser,
  acao: "ler" | "editar" | "validar" = "ler",
): Promise<void> {
  if (!user.permissions.includes(PERMISSION_BY_ACTION[acao])) {
    throw new HttpError(
      403,
      "FORBIDDEN",
      "Permissão insuficiente para esta tarefa",
    );
  }

  const marco = await prisma.marcoEntrega.findUnique({
    where: { id: marcoId },
    select: { id: true, iniciativaId: true },
  });
  if (!marco) {
    throw new HttpError(404, "MARCO_NOT_FOUND", "Tarefa não encontrada");
  }
  await assertIniciativaAccess(user, marco.iniciativaId);
}

export function requireMarcoAccess(
  acao: "ler" | "editar" | "validar" = "ler",
) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) {
        throw new HttpError(401, "UNAUTHORIZED", "Não autenticado");
      }
      const marcoId = req.params.id;
      if (!marcoId) {
        throw new HttpError(400, "MISSING_PARAMS", "Parâmetros inválidos");
      }
      await assertMarcoAccess(marcoId, user, acao);
      next();
    } catch (error) {
      next(error);
    }
  };
}
