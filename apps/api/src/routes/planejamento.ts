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
  mandatoInicio: z.string().datetime().optional().nullable(),
  mandatoFim: z.string().datetime().optional().nullable(),
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
          mandatoInicio: body.mandatoInicio ? new Date(body.mandatoInicio) : null,
          mandatoFim: body.mandatoFim ? new Date(body.mandatoFim) : null,
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
  indicador: z.string().optional(),
  valorBase: z.string().optional(),
  alvo: z.string().optional(),
  unidade: z.string().optional(),
  periodicidade: z.string().optional(),
  prazo: z.string().datetime().optional().nullable(),
  statusValidacao: z.enum(["PENDENTE", "VALIDADO", "REJEITADO"]).optional(),
  perspectivaBsc: z
    .enum(["FINANCEIRA", "CLIENTES", "PROCESSOS", "APRENDIZADO"])
    .optional()
    .nullable(),
  resultadoChaveOkr: z.string().optional().nullable(),
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
        data: {
          planoId: body.planoId,
          secretariaId: body.secretariaId,
          codigo: body.codigo,
          nome: body.nome,
          descricao: body.descricao,
          indicador: body.indicador,
          valorBase: body.valorBase,
          alvo: body.alvo,
          unidade: body.unidade,
          periodicidade: body.periodicidade,
          prazo: body.prazo ? new Date(body.prazo) : null,
          statusValidacao: body.statusValidacao ?? "PENDENTE",
          perspectivaBsc: body.perspectivaBsc ?? null,
          resultadoChaveOkr: body.resultadoChaveOkr ?? null,
        },
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

planejamentoRouter.patch(
  "/metas/:id",
  requirePermission("iniciativa:write"),
  async (req, res, next) => {
    try {
      const body = metaSchema.partial().omit({ planoId: true }).parse(req.body);
      const existing = await prisma.metaEstrategica.findFirst({
        where: {
          id: req.params.id,
          plano: { municipioId: req.user!.municipioId },
        },
      });
      if (!existing) {
        throw new HttpError(404, "NOT_FOUND", "Meta estratégica não encontrada");
      }
      const meta = await prisma.metaEstrategica.update({
        where: { id: existing.id },
        data: {
          ...body,
          prazo: body.prazo === undefined ? undefined : body.prazo ? new Date(body.prazo) : null,
        },
      });
      await writeAudit({
        user: req.user,
        action: "UPDATE",
        entity: "MetaEstrategica",
        entityId: meta.id,
        before: existing,
        after: meta,
        ip: req.ip,
      });
      res.json({ data: meta });
    } catch (err) {
      next(err);
    }
  },
);

const medicaoSchema = z.object({
  metaEstrategicaId: z.string().optional(),
  metaExecucaoId: z.string().optional(),
  dataCorte: z.string().datetime(),
  valorRealizado: z.string().min(1),
  valorEsperado: z.string().optional(),
  fonte: z.string().optional(),
  confiabilidade: z.enum(["BAIXA", "MEDIA", "ALTA"]).optional(),
  observacao: z.string().optional(),
});

planejamentoRouter.post(
  "/medicoes",
  requirePermission("iniciativa:write"),
  async (req, res, next) => {
    try {
      const body = medicaoSchema.parse(req.body);
      if (!body.metaEstrategicaId && !body.metaExecucaoId) {
        throw new HttpError(
          422,
          "TARGET_REQUIRED",
          "Informe meta estratégica ou meta de execução",
        );
      }
      const municipioId = req.user!.municipioId;
      if (body.metaEstrategicaId) {
        const meta = await prisma.metaEstrategica.findFirst({
          where: { id: body.metaEstrategicaId, plano: { municipioId } },
        });
        if (!meta) throw new HttpError(422, "INVALID_META", "Meta estratégica inválida");
      }
      if (body.metaExecucaoId) {
        const meta = await prisma.metaExecucao.findFirst({
          where: {
            id: body.metaExecucaoId,
            iniciativa: { municipioId },
          },
        });
        if (!meta) throw new HttpError(422, "INVALID_META_EXEC", "Meta de execução inválida");
      }
      const medicao = await prisma.medicao.create({
        data: {
          municipioId,
          metaEstrategicaId: body.metaEstrategicaId,
          metaExecucaoId: body.metaExecucaoId,
          dataCorte: new Date(body.dataCorte),
          valorRealizado: body.valorRealizado,
          valorEsperado: body.valorEsperado,
          fonte: body.fonte,
          confiabilidade: body.confiabilidade ?? "MEDIA",
          observacao: body.observacao,
          autorId: req.user!.id,
        },
      });
      if (body.metaExecucaoId) {
        await prisma.metaExecucao.update({
          where: { id: body.metaExecucaoId },
          data: { valorAtual: body.valorRealizado },
        });
      }
      await writeAudit({
        user: req.user,
        action: "CREATE",
        entity: "Medicao",
        entityId: medicao.id,
        after: medicao,
        ip: req.ip,
      });
      res.status(201).json({ data: medicao });
    } catch (err) {
      next(err);
    }
  },
);

planejamentoRouter.get(
  "/medicoes",
  requirePermission("iniciativa:read"),
  async (req, res, next) => {
    try {
      const metaEstrategicaId =
        typeof req.query.metaEstrategicaId === "string"
          ? req.query.metaEstrategicaId
          : undefined;
      const data = await prisma.medicao.findMany({
        where: {
          municipioId: req.user!.municipioId,
          ...(metaEstrategicaId ? { metaEstrategicaId } : {}),
        },
        orderBy: { dataCorte: "desc" },
        take: 200,
      });
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
);
