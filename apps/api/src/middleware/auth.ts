import type { NextFunction, Request, Response } from "express";
import type { Prisma } from "@cip/db";
import jwt from "jsonwebtoken";
import { prisma } from "@cip/db";
import type { PermissionCode, RoleCode } from "@cip/shared";
import { ROLE_PERMISSIONS } from "@cip/shared";
import { HttpError } from "./error";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: RoleCode;
  municipioId: string;
  municipioNome: string;
  secretariaId?: string | null;
  isPlatformAdmin: boolean;
  permissions: PermissionCode[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const DEV_FALLBACK = "dev-secret-change-me";

/** Segredo JWT/NEXTAUTH — em produção/staging nunca usa fallback. */
export function authSecret(): string {
  const value =
    process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || "";
  if (value && value !== DEV_FALLBACK) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "[cip-api] NEXTAUTH_SECRET ou JWT_SECRET obrigatório em produção (não use fallback).",
    );
  }
  return value || DEV_FALLBACK;
}

export function signAccessToken(payload: AuthUser) {
  return jwt.sign(payload, authSecret(), { expiresIn: "8h" });
}

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    next(new HttpError(401, "UNAUTHORIZED", "Token ausente"));
    return;
  }

  let decoded: AuthUser;
  try {
    const payload = jwt.verify(header.slice(7), authSecret());
    if (
      typeof payload !== "object" ||
      payload === null ||
      typeof payload.id !== "string" ||
      typeof payload.municipioId !== "string"
    ) {
      throw new Error("Invalid access token claims");
    }
    decoded = payload as AuthUser;
  } catch {
    next(new HttpError(401, "UNAUTHORIZED", "Sessão inválida ou expirada"));
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { active: true, isPlatformAdmin: true },
    });
    if (!user?.active) {
      throw new HttpError(
        401,
        "UNAUTHORIZED",
        "Usuário inativo ou não encontrado",
      );
    }

    if (user.isPlatformAdmin && !decoded.municipioId) {
      req.user = {
        ...decoded,
        role: "admin",
        municipioId: "",
        municipioNome: "Gestão central CIP",
        secretariaId: null,
        isPlatformAdmin: true,
        permissions: permissionsForRole("admin"),
      };
      next();
      return;
    }

    const municipio = await prisma.municipio.findFirst({
      where: { id: decoded.municipioId, active: true },
      select: { id: true, nome: true },
    });
    if (!municipio) {
      throw new HttpError(401, "UNAUTHORIZED", "Prefeitura inativa ou inexistente");
    }

    const vinculo = await prisma.vinculoUsuarioMunicipio.findUnique({
      where: {
        userId_municipioId: {
          userId: decoded.id,
          municipioId: municipio.id,
        },
      },
      select: { roleCode: true, secretariaId: true },
    });
    if (!vinculo && !user.isPlatformAdmin) {
      throw new HttpError(
        401,
        "UNAUTHORIZED",
        "Usuário sem vínculo com esta prefeitura",
      );
    }

    const rawRole = vinculo?.roleCode || "admin";
    const role = (
      user.isPlatformAdmin
        ? "admin"
        : rawRole &&
            rawRole !== "admin" &&
            rawRole in ROLE_PERMISSIONS
          ? rawRole
          : "leitura"
    ) as RoleCode;

    req.user = {
      ...decoded,
      role,
      municipioId: municipio.id,
      municipioNome: municipio.nome,
      secretariaId: role === "gestor" ? vinculo?.secretariaId ?? null : null,
      isPlatformAdmin: user.isPlatformAdmin,
      permissions: permissionsForRole(role),
    };
    next();
  } catch (error) {
    next(error);
  }
}

export function requirePermission(...needed: PermissionCode[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new HttpError(401, "UNAUTHORIZED", "Não autenticado"));
    }
    if (!req.user!.municipioId) {
      return next(
        new HttpError(
          409,
          "TENANT_CONTEXT_REQUIRED",
          "Selecione uma prefeitura antes de acessar esta área",
        ),
      );
    }
    const ok = needed.every((p) => req.user!.permissions.includes(p));
    if (!ok) {
      return next(new HttpError(403, "FORBIDDEN", "Permissão insuficiente"));
    }
    next();
  };
}

export function requirePlatformAdmin(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (!req.user) {
    return next(new HttpError(401, "UNAUTHORIZED", "Não autenticado"));
  }
  if (!req.user.isPlatformAdmin) {
    return next(
      new HttpError(
        403,
        "PLATFORM_ADMIN_REQUIRED",
        "Ação exclusiva da administração central da CIP",
      ),
    );
  }
  next();
}

/**
 * Aceita qualquer uma das permissões listadas.
 * Gabinete (prefeito) também passa em rotas de secretaria mesmo com token
 * antigo, enquanto o papel no JWT já for "prefeito".
 */
export function requireAnyPermission(
  ...needed: PermissionCode[]
) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new HttpError(401, "UNAUTHORIZED", "Não autenticado"));
    }
    if (!req.user.municipioId) {
      return next(
        new HttpError(
          409,
          "TENANT_CONTEXT_REQUIRED",
          "Selecione uma prefeitura antes de acessar esta área",
        ),
      );
    }
    const perms = req.user.permissions || [];
    const ok =
      needed.some((p) => perms.includes(p)) ||
      (needed.includes("secretaria:manage") && req.user.role === "prefeito");
    if (!ok) {
      return next(new HttpError(403, "FORBIDDEN", "Permissão insuficiente"));
    }
    next();
  };
}

export async function assertMunicipioAccess(
  user: AuthUser,
  municipioId: string,
  entity = "registro",
) {
  if (user.municipioId !== municipioId) {
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        municipioId: user.municipioId,
        action: "ACCESS_DENIED_CROSS_MUNICIPIO",
        entity,
        entityId: municipioId,
        after: {
          attemptedMunicipioId: municipioId,
          userMunicipioId: user.municipioId,
        },
      },
    });
    throw new HttpError(
      403,
      "CROSS_MUNICIPIO_BLOCKED",
      "Acesso bloqueado entre municípios distintos",
    );
  }
}

export async function assertSecretariaAccess(
  user: AuthUser,
  secretariaId: string,
) {
  const secretaria = await prisma.secretaria.findFirst({
    where: {
      id: secretariaId,
      municipioId: user.municipioId,
      active: true,
    },
    select: { id: true },
  });
  if (!secretaria) {
    throw new HttpError(404, "NOT_FOUND", "Secretaria não encontrada");
  }
  if (user.role === "gestor" && user.secretariaId !== secretariaId) {
    throw new HttpError(
      403,
      "SECRETARIA_SCOPED",
      "Acesso restrito à secretaria vinculada ao seu usuário",
    );
  }
}

export async function assertIniciativaAccess(
  user: AuthUser,
  iniciativaId: string,
) {
  const iniciativa = await prisma.iniciativa.findFirst({
    where: { id: iniciativaId },
    select: {
      id: true,
      municipioId: true,
      secretariaPrincipalId: true,
      secretarias: { select: { secretariaId: true } },
    },
  });
  if (!iniciativa) {
    throw new HttpError(404, "NOT_FOUND", "Projeto não encontrado");
  }

  await assertMunicipioAccess(user, iniciativa.municipioId, "Iniciativa");
  if (user.role === "gestor") {
    const participates =
      user.secretariaId === iniciativa.secretariaPrincipalId ||
      iniciativa.secretarias.some(
        (vinculo) => vinculo.secretariaId === user.secretariaId,
      );
    if (!user.secretariaId || !participates) {
      throw new HttpError(
        403,
        "SECRETARIA_SCOPED",
        "Projeto fora do escopo da secretaria vinculada ao seu usuário",
      );
    }
  }
  return iniciativa;
}

export function iniciativaScopeFilter(
  user: AuthUser,
): Prisma.IniciativaWhereInput {
  if (user.role !== "gestor") return {};
  if (!user.secretariaId) return { id: { in: [] } };
  return {
    OR: [
      { secretariaPrincipalId: user.secretariaId },
      { secretarias: { some: { secretariaId: user.secretariaId } } },
    ],
  };
}

export function permissionsForRole(role: RoleCode): PermissionCode[] {
  return ROLE_PERMISSIONS[role] ?? [];
}
