import { Router } from "express";
import { z } from "zod";
import { prisma } from "@cip/db";
import { HttpError } from "../middleware/error";
import { requireAuth, requirePermission } from "../middleware/auth";
import { writeAudit } from "../services/audit";

export const planejamentoRouter = Router();
planejamentoRouter.use(requireAuth);

planejamentoRouter.get(
  "/resumo",
  requirePermission("iniciativa:read"),
  async (req, res, next) => {
    try {
      const municipioId = req.user!.municipioId;
      const planos = await prisma.planoGoverno.findMany({
        where: { municipioId },
        include: {
          metas: {
            include: {
              secretaria: true,
              _count: { select: { iniciativas: true } },
            },
            orderBy: { codigo: "asc" },
          },
        },
        orderBy: { updatedAt: "desc" },
      });

      res.json({
        data: planos.map((plano) => ({
          ...plano,
          createdAt: plano.createdAt.toISOString(),
          updatedAt: plano.updatedAt.toISOString(),
          metas: plano.metas.map((meta) => ({
            ...meta,
            createdAt: meta.createdAt.toISOString(),
            updatedAt: meta.updatedAt.toISOString(),
            iniciativas: meta._count.iniciativas,
          })),
        })),
        meta: { municipioId, fonte: "Base de planejamento CIP" },
      });
    } catch (err) {
      next(err);
    }
  },
);

const planoSchema = z.object({
  nome: z.string().min(3),
  periodo: z.string().min(4).optional(),
  descricao: z.string().optional(),
});

planejamentoRouter.post(
  "/planos",
  requirePermission("iniciativa:write"),
  async (req, res, next) => {
    try {
      const body = planoSchema.parse(req.body);
      const plano = await prisma.planoGoverno.create({
        data: {
          municipioId: req.user!.municipioId,
          nome: body.nome,
          periodo: body.periodo,
          descricao: body.descricao,
        },
      });
      await writeAudit({
        user: req.user,
        action: "CREATE",
        entity: "PlanoGoverno",
        entityId: plano.id,
        after: plano,
        ip: req.ip,
      });
      res.status(201).json({ data: plano });
    } catch (err) {
      next(err);
    }
  },
);

const metaSchema = z.object({
  planoId: z.string().min(1),
  secretariaId: z.string().min(1).optional(),
  codigo: z.string().min(1).optional(),
  nome: z.string().min(3),
  descricao: z.string().optional(),
});

planejamentoRouter.post(
  "/metas",
  requirePermission("iniciativa:write"),
  async (req, res, next) => {
    try {
      const body = metaSchema.parse(req.body);
      const municipioId = req.user!.municipioId;
      const plano = await prisma.planoGoverno.findFirst({
        where: { id: body.planoId, municipioId },
      });
      if (!plano) {
        throw new HttpError(
          422,
          "INVALID_PLANO",
          "O plano de governo não pertence a este município",
        );
      }
      if (body.secretariaId) {
        const secretaria = await prisma.secretaria.findFirst({
          where: { id: body.secretariaId, municipioId, active: true },
        });
        if (!secretaria) {
          throw new HttpError(
            422,
            "INVALID_SECRETARIA",
            "A secretaria da meta não pertence a este município",
          );
        }
      }
      const meta = await prisma.metaEstrategica.create({
        data: body,
      });
      await writeAudit({
        user: req.user,
        action: "CREATE",
        entity: "MetaEstrategica",
        entityId: meta.id,
        after: meta,
        ip: req.ip,
      });
      res.status(201).json({ data: meta });
    } catch (err) {
      next(err);
    }
  },
);
