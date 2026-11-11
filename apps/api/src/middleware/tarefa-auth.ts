import type { Request, Response, NextFunction } from "express";
import { prisma } from "@cip/db";
import { HttpError } from "./error";
import type { AuthUser } from "./auth";

/**
 * Valida se usuário tem permissão para acessar uma tarefa (marco)
 *
 * Regras de autorização:
 * - Admin: acesso total
 * - Gestor/Secretário: acesso apenas a projetos de sua unidade
 * - Analista/Consultor: BLOQUEADO de editar (apenas leitura)
 * - Prefeito: apenas leitura
 * - Leitura: apenas leitura
 */
export async function assertMarcoAccess(
  marcoId: string,
  user: AuthUser,
  acao: "ler" | "editar" | "validar" = "ler"
): Promise<void> {
  // Admins podem fazer qualquer coisa
  if (user.role === "admin") {
    return;
  }

  // Buscar o marco e validar acesso
  const marco = await prisma.marcoEntrega.findUnique({
    where: { id: marcoId },
  });

  if (!marco) {
    throw new HttpError(404, "MARCO_NOT_FOUND", "Tarefa não encontrada");
  }

  // Buscar projeto da iniciativa para validar municipio
  const projeto = await prisma.projetoEstruturante.findUnique({
    where: { id: marco.projetoId },
    include: { iniciativa: true },
  });

  if (!projeto) {
    throw new HttpError(404, "PROJETO_NOT_FOUND", "Projeto não encontrado");
  }

  // Validar municipio
  if (projeto.iniciativa.municipioId !== user.municipioId) {
    throw new HttpError(
      403,
      "MUNICIPIO_MISMATCH",
      "Acesso negado: tarefa em outro município"
    );
  }

  // Validar acesso por papel
  switch (user.role) {
    case "gestor": // Secretário
    case "analista": // Consultor
      // Gestores e consultores precisam ser da mesma unidade
      if (user.secretariaId && marco.secretariaId !== user.secretariaId) {
        throw new HttpError(
          403,
          "SECRETARIA_MISMATCH",
          "Acesso negado: tarefa em outra unidade"
        );
      }

      // Analistas não podem editar
      if (acao === "editar" && user.role === "analista") {
        throw new HttpError(
          403,
          "EXECUTOR_REQUIRED",
          "Apenas o executor designado pode editar a tarefa"
        );
      }
      break;

    case "prefeito":
    case "leitura":
      // Prefeito e leitura: apenas leitura
      if (acao !== "ler") {
        throw new HttpError(
          403,
          "READ_ONLY",
          `Seu perfil (${user.role}) não tem permissão para ${acao} tarefas`
        );
      }
      break;

    default:
      throw new HttpError(403, "INVALID_ROLE", `Perfil inválido: ${user.role}`);
  }
}

/**
 * Middleware Express para validar acesso a tarefa
 * Usa assertMarcoAccess internamente
 *
 * Uso:
 *   router.patch('/marcos/:id', requireMarcoAccess('editar'), handler)
 */
export function requireMarcoAccess(
  acao: "ler" | "editar" | "validar" = "ler"
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const marcoId = req.params.id;
      const user = req.user as AuthUser;

      if (!marcoId || !user) {
        throw new HttpError(400, "MISSING_PARAMS", "Parâmetros inválidos");
      }

      await assertMarcoAccess(marcoId, user, acao);
      next();
    } catch (error) {
      next(error);
    }
  };
}
