import type { NextFunction, Request, Response } from "express";
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

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new HttpError(401, "UNAUTHORIZED", "Token ausente");
    }
    const token = header.slice(7);
    const decoded = jwt.verify(token, authSecret()) as AuthUser;
    req.user = decoded;
    next();
  } catch {
    next(new HttpError(401, "UNAUTHORIZED", "Sessão inválida ou expirada"));
  }
}

export function requirePermission(...needed: PermissionCode[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new HttpError(401, "UNAUTHORIZED", "Não autenticado"));
    }
    const ok = needed.every((p) => req.user!.permissions.includes(p));
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

export function permissionsForRole(role: RoleCode): PermissionCode[] {
  return ROLE_PERMISSIONS[role] ?? [];
}
