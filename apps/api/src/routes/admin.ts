import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@cip/db";
import {
  assertSecretariaAccess,
  iniciativaScopeFilter,
  requirePlatformAdmin,
  requireAnyPermission,
  requireAuth,
  requirePermission,
} from "../middleware/auth";
import { HttpError } from "../middleware/error";
import { writeAudit } from "../services/audit";
import {
  promoteToTitular,
  syncTitularFieldsFromPessoa,
  upsertTitularFromSecretariaFields,
} from "../services/secretaria-pessoas";

export const adminRouter = Router();

adminRouter.use(requireAuth);

const municipioOnboardingSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  uf: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
  ibgeCode: z.string().trim().regex(/^\d{7}$/).nullable().optional(),
  cnpjOrgao: z.string().trim().regex(/^\d{14}$/).nullable().optional(),
  mandatoInicio: z.string().datetime().nullable().optional(),
  mandatoFim: z.string().datetime().nullable().optional(),
  prefeitoNome: z.string().trim().min(2).max(120),
  prefeitoTelefone: z.string().trim().min(8).max(30),
  prefeitoEmail: z.string().trim().email(),
});

adminRouter.get(
  "/municipios",
  requirePlatformAdmin,
  async (_req, res, next) => {
    try {
      const municipios = await prisma.municipio.findMany({
        include: {
          consultorResponsavel: {
            select: { id: true, name: true, email: true, active: true },
          },
          _count: { select: { secretarias: true, iniciativas: true } },
        },
        orderBy: [{ active: "desc" }, { nome: "asc" }],
      });
      res.json({
        data: municipios.map((municipio) => ({
          id: municipio.id,
          nome: municipio.nome,
          uf: municipio.uf,
          ibgeCode: municipio.ibgeCode,
          cnpjOrgao: municipio.cnpjOrgao,
          mandatoInicio: municipio.mandatoInicio?.toISOString() ?? null,
          mandatoFim: municipio.mandatoFim?.toISOString() ?? null,
          prefeitoNome: municipio.prefeitoNome,
          prefeitoTelefone: municipio.prefeitoTelefone,
          prefeitoEmail: municipio.prefeitoEmail,
          active: municipio.active,
          consultorResponsavel: municipio.consultorResponsavel,
          secretarias: municipio._count.secretarias,
          projetos: municipio._count.iniciativas,
        })),
      });
    } catch (err) {
      next(err);
    }
  },
);

adminRouter.post(
  "/municipios",
  requirePlatformAdmin,
  async (req, res, next) => {
    try {
      const body = municipioOnboardingSchema.parse(req.body);
      const mandatoInicio = body.mandatoInicio
        ? new Date(body.mandatoInicio)
        : null;
      const mandatoFim = body.mandatoFim ? new Date(body.mandatoFim) : null;
      if (mandatoInicio && mandatoFim && mandatoFim < mandatoInicio) {
        throw new HttpError(
          422,
          "INVALID_MANDATE_PERIOD",
          "O fim do mandato precisa ser posterior ao início",
        );
      }
      const existing = body.ibgeCode
        ? await prisma.municipio.findUnique({ where: { ibgeCode: body.ibgeCode } })
        : await prisma.municipio.findFirst({
            where: { nome: body.nome, uf: body.uf },
          });
      if (existing) {
        throw new HttpError(
          409,
          "MUNICIPIO_ALREADY_EXISTS",
          "Esta prefeitura já está cadastrada",
        );
      }

      const municipio = await prisma.municipio.create({
        data: {
          nome: body.nome,
          uf: body.uf,
          ibgeCode: body.ibgeCode || null,
          cnpjOrgao: body.cnpjOrgao || null,
          mandatoInicio,
          mandatoFim,
          prefeitoNome: body.prefeitoNome,
          prefeitoTelefone: body.prefeitoTelefone,
          prefeitoEmail: body.prefeitoEmail.toLowerCase(),
        },
      });
      await writeAudit({
        user: req.user,
        action: "MUNICIPIO_ONBOARD",
        entity: "Municipio",
        entityId: municipio.id,
        after: {
          nome: municipio.nome,
          uf: municipio.uf,
          ibgeCode: municipio.ibgeCode,
          prefeitoEmail: municipio.prefeitoEmail,
        },
        ip: req.ip,
      });
      res.status(201).json({ data: municipio });
    } catch (err) {
      next(err);
    }
  },
);

adminRouter.patch(
  "/municipios/:id",
  requirePlatformAdmin,
  async (req, res, next) => {
    try {
      const body = municipioOnboardingSchema.partial().extend({
        active: z.boolean().optional(),
      }).parse(req.body);
      const existing = await prisma.municipio.findUnique({
        where: { id: req.params.id },
      });
      if (!existing) {
        throw new HttpError(404, "TENANT_NOT_FOUND", "Prefeitura não encontrada");
      }
      const start = body.mandatoInicio === undefined
        ? existing.mandatoInicio
        : body.mandatoInicio
          ? new Date(body.mandatoInicio)
          : null;
      const end = body.mandatoFim === undefined
        ? existing.mandatoFim
        : body.mandatoFim
          ? new Date(body.mandatoFim)
          : null;
      if (start && end && end < start) {
        throw new HttpError(
          422,
          "INVALID_MANDATE_PERIOD",
          "O fim do mandato precisa ser posterior ao início",
        );
      }
      const municipio = await prisma.municipio.update({
        where: { id: existing.id },
        data: {
          nome: body.nome,
          uf: body.uf,
          ibgeCode: body.ibgeCode,
          cnpjOrgao: body.cnpjOrgao,
          mandatoInicio:
            body.mandatoInicio === undefined
              ? undefined
              : body.mandatoInicio
                ? new Date(body.mandatoInicio)
                : null,
          mandatoFim:
            body.mandatoFim === undefined
              ? undefined
              : body.mandatoFim
                ? new Date(body.mandatoFim)
                : null,
          prefeitoNome: body.prefeitoNome,
          prefeitoTelefone: body.prefeitoTelefone,
          prefeitoEmail: body.prefeitoEmail?.toLowerCase(),
          active: body.active,
        },
      });
      await writeAudit({
        user: { ...req.user!, municipioId: existing.id },
        action: "MUNICIPIO_UPDATE",
        entity: "Municipio",
        entityId: municipio.id,
        before: {
          nome: existing.nome,
          active: existing.active,
          mandatoInicio: existing.mandatoInicio,
          mandatoFim: existing.mandatoFim,
        },
        after: {
          nome: municipio.nome,
          active: municipio.active,
          mandatoInicio: municipio.mandatoInicio,
          mandatoFim: municipio.mandatoFim,
        },
        ip: req.ip,
      });
      res.json({ data: municipio });
    } catch (err) {
      next(err);
    }
  },
);

adminRouter.get(
  "/consultores",
  requirePlatformAdmin,
  async (_req, res, next) => {
    try {
      const consultores = await prisma.user.findMany({
        where: {
          active: true,
          isPlatformAdmin: false,
          vinculos: { some: { roleCode: "analista" } },
        },
        select: {
          id: true,
          name: true,
          email: true,
          vinculos: {
            where: { roleCode: "analista" },
            select: { municipioId: true, municipio: { select: { nome: true } } },
          },
        },
        orderBy: { name: "asc" },
      });
      res.json({
        data: consultores.map((consultor) => ({
          id: consultor.id,
          name: consultor.name,
          email: consultor.email,
          municipios: consultor.vinculos.map((v) => ({
            id: v.municipioId,
            nome: v.municipio.nome,
          })),
        })),
      });
    } catch (err) {
      next(err);
    }
  },
);

adminRouter.post(
  "/consultores",
  requirePlatformAdmin,
  async (req, res, next) => {
    try {
      const body = z.object({
        name: z.string().trim().min(2).max(120),
        email: z.string().email(),
        password: z.string().min(8),
        municipioId: z.string().min(1),
      }).parse(req.body);
      const email = body.email.trim().toLowerCase();
      const municipio = await prisma.municipio.findFirst({
        where: { id: body.municipioId, active: true },
        select: { id: true, consultorResponsavelId: true },
      });
      if (!municipio) {
        throw new HttpError(404, "TENANT_NOT_FOUND", "Prefeitura não encontrada ou inativa");
      }
      if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
        throw new HttpError(
          409,
          "EMAIL_IN_USE",
          "Este e-mail já possui uma conta. Se já for consultor, atribua a conta existente.",
        );
      }

      const user = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            name: body.name,
            email,
            passwordHash: await bcrypt.hash(body.password, 10),
            vinculos: {
              create: {
                municipioId: municipio.id,
                roleCode: "analista",
                principal: true,
              },
            },
          },
          select: { id: true, name: true, email: true },
        });
        if (
          municipio.consultorResponsavelId &&
          municipio.consultorResponsavelId !== created.id
        ) {
          await tx.vinculoUsuarioMunicipio.deleteMany({
            where: {
              userId: municipio.consultorResponsavelId,
              municipioId: municipio.id,
              roleCode: "analista",
            },
          });
        }
        await tx.municipio.update({
          where: { id: municipio.id },
          data: { consultorResponsavelId: created.id },
        });
        return created;
      });
      await writeAudit({
        user: { ...req.user!, municipioId: municipio.id },
        action: "CONSULTANT_CREATE_AND_ASSIGN",
        entity: "Municipio",
        entityId: municipio.id,
        after: { consultorId: user.id },
        ip: req.ip,
      });
      res.status(201).json({ data: user });
    } catch (err) {
      next(err);
    }
  },
);

adminRouter.post(
  "/municipios/:id/consultor",
  requirePlatformAdmin,
  async (req, res, next) => {
    try {
      const { consultorId } = z
        .object({ consultorId: z.string().nullable() })
        .parse(req.body);
      const municipio = await prisma.municipio.findUnique({
        where: { id: req.params.id },
        select: { id: true, consultorResponsavelId: true },
      });
      if (!municipio) {
        throw new HttpError(404, "TENANT_NOT_FOUND", "Prefeitura não encontrada");
      }
      const consultor = consultorId
        ? await prisma.user.findFirst({
            where: { id: consultorId, active: true, isPlatformAdmin: false },
            select: { id: true, name: true, email: true },
          })
        : null;
      if (consultorId && !consultor) {
        throw new HttpError(
          422,
          "INVALID_CONSULTOR",
          "Selecione uma conta ativa de consultor",
        );
      }

      await prisma.$transaction(async (tx) => {
        if (consultor) {
          const current = await tx.vinculoUsuarioMunicipio.findUnique({
            where: {
              userId_municipioId: {
                userId: consultor.id,
                municipioId: municipio.id,
              },
            },
            select: { roleCode: true },
          });
          if (current && current.roleCode !== "analista") {
            throw new HttpError(
              409,
              "USER_ROLE_CONFLICT",
              "A conta selecionada já possui outro papel nesta prefeitura",
            );
          }
          await tx.vinculoUsuarioMunicipio.upsert({
            where: {
              userId_municipioId: {
                userId: consultor.id,
                municipioId: municipio.id,
              },
            },
            create: {
              userId: consultor.id,
              municipioId: municipio.id,
              roleCode: "analista",
              principal: true,
            },
            update: { roleCode: "analista" },
          });
        }

        const previousConsultorId = municipio.consultorResponsavelId;
        if (
          previousConsultorId &&
          previousConsultorId !== consultor?.id
        ) {
          await tx.vinculoUsuarioMunicipio.deleteMany({
            where: {
              userId: previousConsultorId,
              municipioId: municipio.id,
              roleCode: "analista",
            },
          });
        }
        await tx.municipio.update({
          where: { id: municipio.id },
          data: { consultorResponsavelId: consultor?.id ?? null },
        });
      });
      await writeAudit({
        user: { ...req.user!, municipioId: municipio.id },
        action: "MUNICIPIO_CONSULTOR_ASSIGN",
        entity: "Municipio",
        entityId: municipio.id,
        before: { consultorId: municipio.consultorResponsavelId },
        after: { consultorId },
        ip: req.ip,
      });
      res.json({ ok: true, data: { consultor } });
    } catch (err) {
      next(err);
    }
  },
);

adminRouter.get(
  "/municipios/:id/usuarios",
  requirePlatformAdmin,
  async (req, res, next) => {
    try {
      const municipio = await prisma.municipio.findUnique({
        where: { id: req.params.id },
        select: {
          id: true,
          nome: true,
          secretarias: {
            where: { active: true },
            select: { id: true, nome: true, sigla: true },
            orderBy: { nome: "asc" },
          },
          vinculos: {
            include: {
              user: { select: { id: true, name: true, email: true, active: true } },
              secretaria: { select: { id: true, nome: true } },
            },
            orderBy: { user: { name: "asc" } },
          },
        },
      });
      if (!municipio) {
        throw new HttpError(404, "TENANT_NOT_FOUND", "Prefeitura não encontrada");
      }
      res.json({
        data: {
          id: municipio.id,
          nome: municipio.nome,
          secretarias: municipio.secretarias,
          usuarios: municipio.vinculos.map((vinculo) => ({
            id: vinculo.user.id,
            name: vinculo.user.name,
            email: vinculo.user.email,
            active: vinculo.user.active,
            roleCode: vinculo.roleCode,
            secretariaId: vinculo.secretariaId,
            secretariaNome: vinculo.secretaria?.nome ?? null,
          })),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

adminRouter.post(
  "/municipios/:id/usuarios",
  requirePlatformAdmin,
  async (req, res, next) => {
    try {
      const body = z.object({
        name: z.string().trim().min(2).max(120),
        email: z.string().email(),
        password: z.string().min(6).optional(),
        roleCode: z.enum(["prefeito", "gestor", "leitura"]),
        secretariaId: z.string().optional(),
      }).parse(req.body);
      const municipio = await prisma.municipio.findUnique({
        where: { id: req.params.id },
        select: { id: true },
      });
      if (!municipio) {
        throw new HttpError(404, "TENANT_NOT_FOUND", "Prefeitura não encontrada");
      }
      const secretaria =
        body.roleCode === "gestor"
          ? await prisma.secretaria.findFirst({
              where: {
                id: body.secretariaId,
                municipioId: municipio.id,
                active: true,
              },
              select: { id: true },
            })
          : null;
      if (body.roleCode === "gestor" && !secretaria) {
        throw new HttpError(
          422,
          "INVALID_SECRETARIA",
          "Selecione uma secretaria ativa desta prefeitura",
        );
      }
      if (
        body.roleCode === "prefeito" &&
        await prisma.vinculoUsuarioMunicipio.count({
          where: { municipioId: municipio.id, roleCode: "prefeito" },
        })
      ) {
        throw new HttpError(
          409,
          "PREFEITO_ALREADY_ASSIGNED",
          "Esta prefeitura já possui um usuário com perfil prefeito",
        );
      }

      const email = body.email.trim().toLowerCase();
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser?.isPlatformAdmin) {
        throw new HttpError(
          409,
          "PLATFORM_ACCOUNT_CANNOT_BE_MUNICIPAL",
          "Use uma conta municipal para atribuir este papel",
        );
      }
      const existingVinculo = existingUser
        ? await prisma.vinculoUsuarioMunicipio.findUnique({
            where: {
              userId_municipioId: {
                userId: existingUser.id,
                municipioId: municipio.id,
              },
            },
          })
        : null;
      if (existingVinculo) {
        throw new HttpError(
          409,
          "USER_ALREADY_IN_TENANT",
          "Este usuário já está vinculado a esta prefeitura",
        );
      }
      if (!existingUser && !body.password) {
        throw new HttpError(
          422,
          "PASSWORD_REQUIRED",
          "Informe uma senha inicial para uma nova conta",
        );
      }

      const user = await prisma.$transaction(async (tx) => {
        const linkedUser = existingUser || await tx.user.create({
          data: {
            name: body.name,
            email,
            passwordHash: await bcrypt.hash(body.password!, 10),
            active: true,
          },
        });
        await tx.vinculoUsuarioMunicipio.create({
          data: {
            userId: linkedUser.id,
            municipioId: municipio.id,
            secretariaId: secretaria?.id,
            roleCode: body.roleCode,
            principal: true,
          },
        });
        return linkedUser;
      });
      await writeAudit({
        user: { ...req.user!, municipioId: municipio.id },
        action: "MUNICIPAL_USER_CREATE",
        entity: "User",
        entityId: user.id,
        after: { email: user.email, role: body.roleCode, municipioId: municipio.id },
        ip: req.ip,
      });
      res.status(201).json({
        data: { id: user.id, name: user.name, email: user.email },
      });
    } catch (err) {
      next(err);
    }
  },
);

/** Só a consultoria (e o admin CIP) edita cadastros das pastas; o gabinete apenas acompanha. */
const requireSecretariaWrite = requireAnyPermission(
  "secretaria:manage",
  "iniciativa:write",
);

function normalizeSigla(raw: string | null | undefined): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  const cleaned = raw.trim().toUpperCase();
  return cleaned || null;
}

adminRouter.get(
  "/secretarias",
  requirePermission("iniciativa:read"),
  async (req, res, next) => {
    try {
      const rows = await prisma.secretaria.findMany({
        where: {
          municipioId: req.user!.municipioId,
          active: true,
          ...(req.user!.role === "gestor"
            ? { id: req.user!.secretariaId || "__no_secretaria__" }
            : {}),
        },
        orderBy: { nome: "asc" },
      });
      res.json({ data: rows });
    } catch (err) {
      next(err);
    }
  },
);

const secretariaCreateSchema = z.object({
  nome: z.string().trim().min(3).max(120),
  sigla: z
    .string()
    .trim()
    .min(2)
    .max(12)
    .optional()
    .or(z.literal(""))
    .nullable(),
});

adminRouter.post(
  "/secretarias",
  requireSecretariaWrite,
  async (req, res, next) => {
    try {
      const body = secretariaCreateSchema.parse(req.body);
      const municipioId = req.user!.municipioId;
      const nome = body.nome.trim();
      const sigla = normalizeSigla(body.sigla ?? null) ?? null;

      const conflitoNome = await prisma.secretaria.findFirst({
        where: { municipioId, nome },
      });
      if (conflitoNome) {
        throw new HttpError(
          409,
          "DUPLICATE_NOME",
          "Já existe uma secretaria com este nome no município",
        );
      }
      if (sigla) {
        const conflitoSigla = await prisma.secretaria.findFirst({
          where: { municipioId, active: true, sigla },
        });
        if (conflitoSigla) {
          throw new HttpError(
            409,
            "DUPLICATE_SIGLA",
            "Já existe uma secretaria ativa com esta sigla",
          );
        }
      }

      const created = await prisma.secretaria.create({
        data: {
          municipioId,
          nome,
          sigla,
          active: true,
        },
      });

      await writeAudit({
        user: req.user,
        action: "SECRETARIA_CREATE",
        entity: "Secretaria",
        entityId: created.id,
        after: { nome: created.nome, sigla: created.sigla },
        ip: req.ip,
      });

      res.status(201).json({ data: created });
    } catch (err) {
      next(err);
    }
  },
);

const secretariaTitularSchema = z.object({
  nome: z.string().trim().min(3).max(120).optional(),
  titularNome: z.string().min(2).nullable().optional(),
  titularCargo: z.string().nullable().optional(),
  titularTelefone: z.string().nullable().optional(),
  titularEmail: z.string().email().nullable().optional().or(z.literal("")),
  sigla: z.string().nullable().optional(),
});

adminRouter.patch(
  "/secretarias/:id",
  requireSecretariaWrite,
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

      const nome = body.nome === undefined ? undefined : body.nome.trim();
      const sigla = normalizeSigla(body.sigla);

      if (nome && nome !== existing.nome) {
        const conflitoNome = await prisma.secretaria.findFirst({
          where: {
            municipioId: existing.municipioId,
            nome,
            NOT: { id: existing.id },
          },
        });
        if (conflitoNome) {
          throw new HttpError(
            409,
            "DUPLICATE_NOME",
            "Já existe uma secretaria com este nome no município",
          );
        }
      }
      if (sigla && sigla !== existing.sigla) {
        const conflitoSigla = await prisma.secretaria.findFirst({
          where: {
            municipioId: existing.municipioId,
            active: true,
            sigla,
            NOT: { id: existing.id },
          },
        });
        if (conflitoSigla) {
          throw new HttpError(
            409,
            "DUPLICATE_SIGLA",
            "Já existe uma secretaria ativa com esta sigla",
          );
        }
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
            nome,
            titularNome:
              body.titularNome === undefined ? undefined : body.titularNome,
            titularCargo:
              body.titularCargo === undefined ? undefined : body.titularCargo,
            titularTelefone:
              body.titularTelefone === undefined
                ? undefined
                : body.titularTelefone,
            titularEmail,
            sigla,
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
        action: "SECRETARIA_UPDATE",
        entity: "Secretaria",
        entityId: updated.id,
        before: {
          nome: existing.nome,
          sigla: existing.sigla,
          titularNome: existing.titularNome,
          titularTelefone: existing.titularTelefone,
        },
        after: {
          nome: updated.nome,
          sigla: updated.sigla,
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
      if (req.user!.role === "gestor") {
        await assertSecretariaAccess(req.user!, secretaria.id);
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
      if (req.user!.role === "gestor") {
        await assertSecretariaAccess(req.user!, secretaria.id);
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
  requireSecretariaWrite,
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
  requireSecretariaWrite,
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
        where: {
          municipioId: req.user!.municipioId,
          ...(req.user!.role === "gestor"
            ? {
                iniciativas: {
                  some: {
                    iniciativa: {
                      AND: [iniciativaScopeFilter(req.user!)],
                    },
                  },
                },
              }
            : {}),
        },
        include: {
          iniciativas: {
            where: {
              iniciativa: { AND: [iniciativaScopeFilter(req.user!)] },
            },
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
          vinculos: {
            where: { municipioId: req.user!.municipioId },
            include: { secretaria: true },
          },
        },
        orderBy: { name: "asc" },
      });
      res.json({
        data: rows.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          active: u.active,
          roles: u.vinculos.map((v) => v.roleCode),
          municipios: [req.user!.municipioNome],
          secretarias: u.vinculos.map((v) => v.secretaria?.nome ?? null),
          secretariaId: u.vinculos[0]?.secretariaId ?? null,
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
  roleCode: z.enum(["prefeito", "gestor", "leitura"]),
  secretariaId: z.string().optional(),
});

adminRouter.post(
  "/usuarios",
  requirePermission("users:manage"),
  async (req, res, next) => {
    try {
      const body = userSchema.parse(req.body);
      const email = body.email.trim().toLowerCase();
      if (body.roleCode === "gestor" && !body.secretariaId) {
        throw new HttpError(
          422,
          "SECRETARIA_REQUIRED",
          "Selecione a secretaria do secretário",
        );
      }
      if (
        body.roleCode === "prefeito" &&
        (await prisma.vinculoUsuarioMunicipio.count({
          where: {
            municipioId: req.user!.municipioId,
            roleCode: "prefeito",
          },
        }))
      ) {
        throw new HttpError(
          409,
          "PREFEITO_ALREADY_ASSIGNED",
          "Esta prefeitura já possui um usuário com perfil prefeito",
        );
      }
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        throw new HttpError(
          409,
          "USER_EXISTS_CONTACT_CIP",
          "Este e-mail já possui uma conta. A CIP deve fazer o vínculo com esta prefeitura.",
        );
      }
      const secretaria =
        body.roleCode === "gestor"
          ? await prisma.secretaria.findFirst({
              where: {
                id: body.secretariaId,
                municipioId: req.user!.municipioId,
                active: true,
              },
              select: { id: true },
            })
          : null;
      if (body.roleCode === "gestor" && !secretaria) {
        throw new HttpError(
          422,
          "INVALID_SECRETARIA",
          "A secretaria selecionada não pertence ao município ou está inativa",
        );
      }
      const passwordHash = await bcrypt.hash(body.password, 10);
      const user = await prisma.user.create({
        data: {
          name: body.name,
          email,
          passwordHash,
          vinculos: {
            create: {
              municipioId: req.user!.municipioId,
              secretariaId: secretaria?.id,
              roleCode: body.roleCode,
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

adminRouter.patch(
  "/usuarios/:id/secretaria",
  requirePermission("users:manage"),
  async (req, res, next) => {
    try {
      const { secretariaId } = z
        .object({ secretariaId: z.string().min(1) })
        .parse(req.body);
      const municipioId = req.user!.municipioId;
      const usuario = await prisma.user.findFirst({
        where: {
          id: req.params.id,
          vinculos: { some: { municipioId, roleCode: "gestor" } },
        },
        select: { id: true },
      });
      if (!usuario) {
        throw new HttpError(
          404,
          "GESTOR_NOT_FOUND",
          "Secretário não encontrado neste município",
        );
      }

      const secretaria = await prisma.secretaria.findFirst({
        where: { id: secretariaId, municipioId, active: true },
        select: { id: true, nome: true },
      });
      if (!secretaria) {
        throw new HttpError(
          422,
          "INVALID_SECRETARIA",
          "A secretaria selecionada não pertence ao município ou está inativa",
        );
      }

      await prisma.vinculoUsuarioMunicipio.update({
        where: { userId_municipioId: { userId: usuario.id, municipioId } },
        data: { secretariaId: secretaria.id },
      });
      await writeAudit({
        user: req.user,
        action: "USER_SECRETARIA_ASSIGN",
        entity: "User",
        entityId: usuario.id,
        after: { secretariaId: secretaria.id, secretaria: secretaria.nome },
        ip: req.ip,
      });
      res.json({ ok: true });
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
