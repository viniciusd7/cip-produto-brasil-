import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@cip/db";
import { requireAuth, requirePermission } from "../middleware/auth";
import { writeAudit } from "../services/audit";
import {
  promoteToTitular,
  syncTitularFieldsFromPessoa,
  upsertTitularFromSecretariaFields,
} from "../services/secretaria-pessoas";

export const adminRouter = Router();

adminRouter.use(requireAuth);

adminRouter.get(
  "/secretarias",
  requirePermission("iniciativa:read"),
  async (req, res, next) => {
    try {
      const rows = await prisma.secretaria.findMany({
        where: { municipioId: req.user!.municipioId, active: true },
        orderBy: { nome: "asc" },
      });
      res.json({ data: rows });
    } catch (err) {
      next(err);
    }
  },
);

const secretariaTitularSchema = z.object({
  titularNome: z.string().min(2).nullable().optional(),
  titularCargo: z.string().nullable().optional(),
  titularTelefone: z.string().nullable().optional(),
  titularEmail: z.string().email().nullable().optional().or(z.literal("")),
  sigla: z.string().nullable().optional(),
});

adminRouter.patch(
  "/secretarias/:id",
  requirePermission("iniciativa:write"),
  async (req, res, next) => {
    try {
      const body = secretariaTitularSchema.parse(req.body);
      const existing = await prisma.secretaria.findFirst({
        where: { id: req.params.id, municipioId: req.user!.municipioId },
      });
      if (!existing) {
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: "Secretaria não encontrada" },
        });
      }

      const titularEmail =
        body.titularEmail === undefined || body.titularEmail === ""
          ? body.titularEmail === ""
            ? null
            : undefined
          : body.titularEmail;

      const updated = await prisma.$transaction(async (tx) => {
        const row = await tx.secretaria.update({
          where: { id: existing.id },
          data: {
            titularNome:
              body.titularNome === undefined ? undefined : body.titularNome,
            titularCargo:
              body.titularCargo === undefined ? undefined : body.titularCargo,
            titularTelefone:
              body.titularTelefone === undefined
                ? undefined
                : body.titularTelefone,
            titularEmail,
            sigla: body.sigla === undefined ? undefined : body.sigla,
          },
        });

        if (
          body.titularNome !== undefined ||
          body.titularCargo !== undefined ||
          body.titularTelefone !== undefined ||
          body.titularEmail !== undefined
        ) {
          await upsertTitularFromSecretariaFields(tx, existing.id, {
            titularNome:
              body.titularNome !== undefined
                ? body.titularNome
                : row.titularNome,
            titularCargo:
              body.titularCargo !== undefined
                ? body.titularCargo
                : row.titularCargo,
            titularTelefone:
              body.titularTelefone !== undefined
                ? body.titularTelefone
                : row.titularTelefone,
            titularEmail:
              titularEmail !== undefined ? titularEmail : row.titularEmail,
          });
        }

        return row;
      });

      await writeAudit({
        user: req.user,
        action: "SECRETARIA_TITULAR_UPDATE",
        entity: "Secretaria",
        entityId: updated.id,
        before: {
          titularNome: existing.titularNome,
          titularTelefone: existing.titularTelefone,
        },
        after: {
          titularNome: updated.titularNome,
          titularTelefone: updated.titularTelefone,
        },
        ip: req.ip,
      });
      res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  },
);

adminRouter.get(
  "/secretarias/:id",
  requirePermission("iniciativa:read"),
  async (req, res, next) => {
    try {
      const secretaria = await prisma.secretaria.findFirst({
        where: {
          id: req.params.id,
          municipioId: req.user!.municipioId,
        },
        include: {
          pessoas: {
            where: { ativo: true },
            orderBy: [{ papel: "desc" }, { nome: "asc" }],
          },
          metas: {
            include: {
              plano: true,
              iniciativas: {
                select: {
                  id: true,
                  codigo: true,
                  nome: true,
                  ciclo: true,
                  estruturante: true,
                  atualizadoEm: true,
                },
              },
            },
          },
          iniciativas: {
            orderBy: { atualizadoEm: "desc" },
            include: {
              metaEstrategica: true,
              _count: { select: { marcos: true, metasExecucao: true } },
            },
          },
        },
      });
      if (!secretaria) {
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: "Secretaria não encontrada" },
        });
      }
      res.json({ data: secretaria });
    } catch (err) {
      next(err);
    }
  },
);

const pessoaSchema = z.object({
  nome: z.string().min(2),
  cargo: z.string().min(2),
  telefone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal("")),
  papel: z.enum(["TITULAR", "EQUIPE"]).default("EQUIPE"),
});

const pessoaPatchSchema = z.object({
  nome: z.string().min(2).optional(),
  cargo: z.string().min(2).optional(),
  telefone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal("")),
  papel: z.enum(["TITULAR", "EQUIPE"]).optional(),
  ativo: z.boolean().optional(),
});

async function findSecretariaOr404(id: string, municipioId: string) {
  const secretaria = await prisma.secretaria.findFirst({
    where: { id, municipioId },
  });
  if (!secretaria) {
    return null;
  }
  return secretaria;
}

adminRouter.get(
  "/secretarias/:id/pessoas",
  requirePermission("iniciativa:read"),
  async (req, res, next) => {
    try {
      const secretaria = await findSecretariaOr404(
        req.params.id,
        req.user!.municipioId,
      );
      if (!secretaria) {
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: "Secretaria não encontrada" },
        });
      }
      const rows = await prisma.secretariaPessoa.findMany({
        where: { secretariaId: secretaria.id, ativo: true },
        orderBy: [{ papel: "desc" }, { nome: "asc" }],
      });
      res.json({ data: rows });
    } catch (err) {
      next(err);
    }
  },
);

adminRouter.post(
  "/secretarias/:id/pessoas",
  requirePermission("iniciativa:write"),
  async (req, res, next) => {
    try {
      const body = pessoaSchema.parse(req.body);
      const secretaria = await findSecretariaOr404(
        req.params.id,
        req.user!.municipioId,
      );
      if (!secretaria) {
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: "Secretaria não encontrada" },
        });
      }

      const email =
        body.email === undefined || body.email === "" ? null : body.email;

      const pessoa = await prisma.$transaction(async (tx) => {
        const created = await tx.secretariaPessoa.create({
          data: {
            secretariaId: secretaria.id,
            nome: body.nome.trim(),
            cargo: body.cargo.trim(),
            telefone: body.telefone?.trim() || null,
            email,
            papel: body.papel === "TITULAR" ? "EQUIPE" : body.papel,
            ativo: true,
          },
        });

        if (body.papel === "TITULAR") {
          return promoteToTitular(tx, secretaria.id, created.id);
        }
        return created;
      });

      await writeAudit({
        user: req.user,
        action: "SECRETARIA_PESSOA_CREATE",
        entity: "SecretariaPessoa",
        entityId: pessoa.id,
        after: {
          nome: pessoa.nome,
          cargo: pessoa.cargo,
          papel: pessoa.papel,
          secretariaId: secretaria.id,
        },
        ip: req.ip,
      });

      res.status(201).json({ data: pessoa });
    } catch (err) {
      next(err);
    }
  },
);

adminRouter.patch(
  "/secretarias/:id/pessoas/:pessoaId",
  requirePermission("iniciativa:write"),
  async (req, res, next) => {
    try {
      const body = pessoaPatchSchema.parse(req.body);
      const secretaria = await findSecretariaOr404(
        req.params.id,
        req.user!.municipioId,
      );
      if (!secretaria) {
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: "Secretaria não encontrada" },
        });
      }

      const existing = await prisma.secretariaPessoa.findFirst({
        where: { id: req.params.pessoaId, secretariaId: secretaria.id },
      });
      if (!existing) {
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: "Pessoa não encontrada" },
        });
      }

      const email =
        body.email === undefined
          ? undefined
          : body.email === ""
            ? null
            : body.email;

      const pessoa = await prisma.$transaction(async (tx) => {
        let updated = await tx.secretariaPessoa.update({
          where: { id: existing.id },
          data: {
            nome: body.nome === undefined ? undefined : body.nome.trim(),
            cargo: body.cargo === undefined ? undefined : body.cargo.trim(),
            telefone:
              body.telefone === undefined
                ? undefined
                : body.telefone?.trim() || null,
            email,
            ativo: body.ativo,
            papel:
              body.papel === "TITULAR"
                ? existing.papel
                : body.papel === undefined
                  ? undefined
                  : body.papel,
          },
        });

        if (body.papel === "TITULAR" && body.ativo !== false) {
          updated = await promoteToTitular(tx, secretaria.id, updated.id);
        } else if (
          existing.papel === "TITULAR" &&
          (body.ativo === false || body.papel === "EQUIPE")
        ) {
          await syncTitularFieldsFromPessoa(tx, secretaria.id);
        } else if (updated.papel === "TITULAR" && updated.ativo) {
          await syncTitularFieldsFromPessoa(tx, secretaria.id);
        }

        return updated;
      });

      await writeAudit({
        user: req.user,
        action: "SECRETARIA_PESSOA_UPDATE",
        entity: "SecretariaPessoa",
        entityId: pessoa.id,
        before: {
          nome: existing.nome,
          cargo: existing.cargo,
          papel: existing.papel,
          ativo: existing.ativo,
        },
        after: {
          nome: pessoa.nome,
          cargo: pessoa.cargo,
          papel: pessoa.papel,
          ativo: pessoa.ativo,
        },
        ip: req.ip,
      });

      res.json({ data: pessoa });
    } catch (err) {
      next(err);
    }
  },
);

adminRouter.get(
  "/tipos-verificacao",
  requirePermission("iniciativa:read"),
  async (_req, res, next) => {
    try {
      const rows = await prisma.tipoVerificacao.findMany({
        where: { active: true },
        orderBy: { nome: "asc" },
      });
      res.json({ data: rows });
    } catch (err) {
      next(err);
    }
  },
);

adminRouter.get(
  "/compromissos",
  requirePermission("iniciativa:read"),
  async (req, res, next) => {
    try {
      const rows = await prisma.compromisso.findMany({
        where: { municipioId: req.user!.municipioId },
        orderBy: { titulo: "asc" },
      });
      res.json({ data: rows });
    } catch (err) {
      next(err);
    }
  },
);

adminRouter.get(
  "/equipamentos",
  requirePermission("iniciativa:read"),
  async (req, res, next) => {
    try {
      const rows = await prisma.equipamentoPublico.findMany({
        where: { municipioId: req.user!.municipioId },
        include: {
          iniciativas: {
            include: { iniciativa: { select: { id: true, nome: true, codigo: true } } },
          },
        },
        orderBy: { nome: "asc" },
      });
      res.json({ data: rows });
    } catch (err) {
      next(err);
    }
  },
);

adminRouter.get(
  "/usuarios",
  requirePermission("users:manage"),
  async (req, res, next) => {
    try {
      const rows = await prisma.user.findMany({
        where: {
          vinculos: { some: { municipioId: req.user!.municipioId } },
        },
        include: {
          roles: { include: { role: true } },
          vinculos: { include: { municipio: true } },
        },
        orderBy: { name: "asc" },
      });
      res.json({
        data: rows.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          active: u.active,
          roles: u.roles.map((r) => r.role.code),
          municipios: u.vinculos.map((v) => v.municipio.nome),
        })),
      });
    } catch (err) {
      next(err);
    }
  },
);

const userSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  roleCode: z.enum(["admin", "prefeito", "gestor", "analista", "leitura"]),
});

adminRouter.post(
  "/usuarios",
  requirePermission("users:manage"),
  async (req, res, next) => {
    try {
      const body = userSchema.parse(req.body);
      const role = await prisma.role.findUniqueOrThrow({
        where: { code: body.roleCode },
      });
      const passwordHash = await bcrypt.hash(body.password, 10);
      const user = await prisma.user.create({
        data: {
          name: body.name,
          email: body.email.toLowerCase(),
          passwordHash,
          roles: { create: { roleId: role.id } },
          vinculos: {
            create: {
              municipioId: req.user!.municipioId,
              principal: true,
            },
          },
        },
      });

      await writeAudit({
        user: req.user,
        action: "CREATE",
        entity: "User",
        entityId: user.id,
        after: { email: user.email, role: body.roleCode },
        ip: req.ip,
      });

      res.status(201).json({
        data: { id: user.id, email: user.email, name: user.name },
      });
    } catch (err) {
      next(err);
    }
  },
);

adminRouter.get(
  "/auditoria",
  requirePermission("audit:read"),
  async (req, res, next) => {
    try {
      const rows = await prisma.auditLog.findMany({
        where: { municipioId: req.user!.municipioId },
        include: { actor: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      res.json({ data: rows });
    } catch (err) {
      next(err);
    }
  },
);
