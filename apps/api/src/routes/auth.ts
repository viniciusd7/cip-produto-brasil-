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
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
      include: {
        roles: { include: { role: true } },
        vinculos: {
          where: { principal: true },
          include: { municipio: true },
          take: 1,
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

    const role = (user.roles[0]?.role.code || "leitura") as RoleCode;
    const vinculo = user.vinculos[0];
    if (!vinculo) {
      throw new HttpError(
        403,
        "NO_MUNICIPIO",
        "Usuário sem vínculo municipal ativo",
      );
    }

    const authUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role,
      municipioId: vinculo.municipioId,
      municipioNome: vinculo.municipio.nome,
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
