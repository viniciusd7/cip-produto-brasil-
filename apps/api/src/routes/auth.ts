import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@cip/db";
import type { RoleCode } from "@cip/shared";
import {
  permissionsForRole,
  requireAuth,
  signAccessToken,
} from "../middleware/auth";
import { HttpError } from "../middleware/error";
import { writeAudit } from "../services/audit";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  municipioId: z.string().optional(),
  preview: z.boolean().optional(),
});

function isRoleCode(value: string): value is RoleCode {
  return ["admin", "prefeito", "gestor", "analista", "leitura"].includes(value);
}

authRouter.post("/login", async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
      include: {
        vinculos: {
          where: { municipio: { active: true } },
          include: { municipio: true, secretaria: true },
          orderBy: { municipio: { nome: "asc" } },
        },
      },
    });

    if (!user || !user.active) {
      throw new HttpError(401, "INVALID_CREDENTIALS", "Credenciais inválidas");
    }

    const ok = await bcrypt.compare(body.password, user.passwordHash);
    if (!ok) {
      throw new HttpError(401, "INVALID_CREDENTIALS", "Credenciais inválidas");
    }

    const tenants = user.vinculos.map((vinculo) => ({
      id: vinculo.municipioId,
      nome: vinculo.municipio.nome,
      uf: vinculo.municipio.uf,
      role: vinculo.roleCode,
      secretariaId: vinculo.secretariaId,
      secretariaNome: vinculo.secretaria?.nome ?? null,
    }));

    if (body.preview) {
      return res.json({
        data: {
          isPlatformAdmin: user.isPlatformAdmin,
          requiresSelection: !user.isPlatformAdmin && tenants.length > 1,
          tenants: user.isPlatformAdmin ? [] : tenants,
        },
      });
    }

    let municipioId = body.municipioId || "";
    let municipioNome = "Gestão central CIP";
    let role: RoleCode = "admin";
    let secretariaId: string | null = null;

    if (user.isPlatformAdmin) {
      if (municipioId) {
        const municipio = await prisma.municipio.findFirst({
          where: { id: municipioId, active: true },
          select: { id: true, nome: true },
        });
        if (!municipio) {
          throw new HttpError(404, "TENANT_NOT_FOUND", "Prefeitura não encontrada");
        }
        municipioId = municipio.id;
        municipioNome = municipio.nome;
      }
    } else {
      if (!user.vinculos.length) {
        throw new HttpError(
          403,
          "NO_MUNICIPIO",
          "Usuário sem vínculo com uma prefeitura ativa",
        );
      }
      if (!municipioId && user.vinculos.length > 1) {
        throw new HttpError(
          409,
          "TENANT_SELECTION_REQUIRED",
          "Selecione uma prefeitura para continuar",
        );
      }
      const vinculo =
        user.vinculos.find((item) => item.municipioId === municipioId) ||
        (!municipioId ? user.vinculos[0] : undefined);
      if (!vinculo) {
        throw new HttpError(
          403,
          "TENANT_ACCESS_DENIED",
          "Esta conta não tem acesso à prefeitura selecionada",
        );
      }
      if (
        vinculo.roleCode === "prefeito" &&
        user.vinculos.some((item) => item.municipioId !== vinculo.municipioId)
      ) {
        throw new HttpError(
          403,
          "PREFEITO_MULTI_TENANT",
          "O perfil prefeito só pode estar vinculado a uma prefeitura",
        );
      }
      municipioId = vinculo.municipioId;
      municipioNome = vinculo.municipio.nome;
      role = isRoleCode(vinculo.roleCode) && vinculo.roleCode !== "admin"
        ? vinculo.roleCode
        : "leitura";
      secretariaId = role === "gestor" ? vinculo.secretariaId : null;
    }

    const authUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role,
      municipioId,
      municipioNome,
      secretariaId,
      isPlatformAdmin: user.isPlatformAdmin,
      permissions: permissionsForRole(role),
    };

    const accessToken = signAccessToken(authUser);

    await writeAudit({
      user: authUser,
      action: "LOGIN",
      entity: "User",
      entityId: user.id,
      ip: req.ip,
    });

    res.json({
      data: {
        accessToken,
        user: {
          id: authUser.id,
          email: authUser.email,
          name: authUser.name,
          role: authUser.role,
          municipioId: authUser.municipioId,
          municipioNome: authUser.municipioNome,
          secretariaId: authUser.secretariaId,
          isPlatformAdmin: authUser.isPlatformAdmin,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.get("/contexts", requireAuth, async (req, res, next) => {
  try {
    const municipios = await prisma.municipio.findMany({
      where: req.user!.isPlatformAdmin
        ? { active: true }
        : {
            active: true,
            vinculos: { some: { userId: req.user!.id } },
          },
      select: {
        id: true,
        nome: true,
        uf: true,
        vinculos: {
          where: { userId: req.user!.id },
          select: { roleCode: true, secretariaId: true },
        },
      },
      orderBy: { nome: "asc" },
    });

    res.json({
      data: {
        isPlatformAdmin: req.user!.isPlatformAdmin,
        activeMunicipioId: req.user!.municipioId || null,
        tenants: municipios.map((municipio) => {
          if (req.user!.isPlatformAdmin) {
            return { id: municipio.id, nome: municipio.nome, uf: municipio.uf, role: "admin" };
          }
          const membership = municipio.vinculos[0];
          return {
            id: municipio.id,
            nome: municipio.nome,
            uf: municipio.uf,
            role: membership?.roleCode || "leitura",
            secretariaId: membership?.secretariaId ?? null,
          };
        }),
      },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/select-tenant", requireAuth, async (req, res, next) => {
  try {
    const body = z
      .object({ municipioId: z.string().nullable().optional() })
      .parse(req.body);
    const municipioId = body.municipioId || "";
    const user = await prisma.user.findFirst({
      where: { id: req.user!.id, active: true },
      select: { id: true, email: true, name: true, isPlatformAdmin: true },
    });
    if (!user) {
      throw new HttpError(401, "UNAUTHORIZED", "Conta inativa ou inexistente");
    }

    let role: RoleCode = "admin";
    let municipioNome = "Gestão central CIP";
    let secretariaId: string | null = null;

    if (!municipioId && user.isPlatformAdmin) {
      role = "admin";
    } else {
      if (!municipioId) {
        throw new HttpError(
          422,
          "TENANT_REQUIRED",
          "Selecione uma prefeitura válida",
        );
      }
      const municipio = await prisma.municipio.findFirst({
        where: { id: municipioId, active: true },
        select: { id: true, nome: true },
      });
      if (!municipio) {
        throw new HttpError(404, "TENANT_NOT_FOUND", "Prefeitura não encontrada");
      }

      const vinculo = await prisma.vinculoUsuarioMunicipio.findUnique({
        where: {
          userId_municipioId: { userId: user.id, municipioId: municipio.id },
        },
        select: { roleCode: true, secretariaId: true },
      });
      if (!vinculo && !user.isPlatformAdmin) {
        throw new HttpError(
          403,
          "TENANT_ACCESS_DENIED",
          "Esta conta não tem acesso à prefeitura selecionada",
        );
      }
      role = user.isPlatformAdmin
        ? "admin"
        : isRoleCode(vinculo!.roleCode) && vinculo!.roleCode !== "admin"
          ? vinculo!.roleCode
          : "leitura";
      secretariaId = role === "gestor" ? vinculo?.secretariaId ?? null : null;
      municipioNome = municipio.nome;
    }

    const authUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role,
      municipioId,
      municipioNome,
      secretariaId,
      isPlatformAdmin: user.isPlatformAdmin,
      permissions: permissionsForRole(role),
    };
    const accessToken = signAccessToken(authUser);

    await writeAudit({
      user: authUser,
      action: "TENANT_CONTEXT_SWITCH",
      entity: "VinculoUsuarioMunicipio",
      entityId: municipioId || undefined,
      before: { municipioId: req.user!.municipioId || null },
      after: { municipioId: municipioId || null, role },
      ip: req.ip,
    });

    res.json({
      data: {
        accessToken,
        user: {
          id: authUser.id,
          email: authUser.email,
          name: authUser.name,
          role: authUser.role,
          municipioId: authUser.municipioId,
          municipioNome: authUser.municipioNome,
          secretariaId: authUser.secretariaId,
          isPlatformAdmin: authUser.isPlatformAdmin,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", requireAuth, async (req, res) => {
  res.json({ data: req.user });
});
