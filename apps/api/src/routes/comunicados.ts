import { Router } from "express";
import { z } from "zod";
import { prisma } from "@cip/db";
import { requireAuth, requirePermission, assertMunicipioAccess } from "../middleware/auth";
import { HttpError } from "../middleware/error";

export const comunicadosRouter = Router();
comunicadosRouter.use(requireAuth, requirePermission("iniciativa:read"));
comunicadosRouter.get("/destinatarios", async (req, res, next) => {
  try {
    const data = await prisma.user.findMany({ where: { active: true, vinculos: { some: { municipioId: req.user!.municipioId } }, roles: { some: { role: { code: { in: ["gestor", "analista", "admin"] } } } } }, select: { id: true, name: true, roles: { select: { role: { select: { name: true } } } } }, orderBy: { name: "asc" } });
    res.json({ data });
  } catch (err) { next(err); }
});
comunicadosRouter.get("/", async (req, res, next) => {
  try {
    const iniciativaId = typeof req.query.iniciativaId === "string" ? req.query.iniciativaId : undefined;
    const data = await prisma.comunicado.findMany({ where: {
      iniciativa: { municipioId: req.user!.municipioId },
      ...(!iniciativaId && req.query.naoLidos === "1" ? { leituras: { none: { userId: req.user!.id } } } : {}),
      ...(iniciativaId ? { iniciativaId } : { OR: [{ destinatarioId: req.user!.id }, { destinoPapel: req.user!.role }] }),
    }, include: { autor: { select: { name: true } }, destinatario: { select: { name: true } }, iniciativa: { select: { id: true, nome: true, secretariaPrincipal: { select: { nome: true } } } }, leituras: { where: { userId: req.user!.id } } }, orderBy: { createdAt: "desc" }, take: 100 });
    const naoLidos = await prisma.comunicado.count({ where: { iniciativa: { municipioId: req.user!.municipioId }, OR: [{ destinatarioId: req.user!.id }, { destinoPapel: req.user!.role }], leituras: { none: { userId: req.user!.id } } } });
    res.json({ data, naoLidos });
  } catch (err) { next(err); }
});
comunicadosRouter.post("/", requirePermission("iniciativa:write"), async (req, res, next) => {
  try {
    const body = z.object({ iniciativaId: z.string().min(1), destinatarioId: z.string().min(1), texto: z.string().trim().min(3).max(5000) }).parse(req.body);
    const ini = await prisma.iniciativa.findUnique({ where: { id: body.iniciativaId } });
    if (!ini) throw new HttpError(404, "NOT_FOUND", "Projeto não encontrado");
    await assertMunicipioAccess(req.user!, ini.municipioId);
    const destino = await prisma.user.findFirst({ where: { id: body.destinatarioId, active: true, vinculos: { some: { municipioId: req.user!.municipioId } }, roles: { some: { role: { code: { in: ["gestor", "analista", "admin"] } } } } } });
    if (!destino) throw new HttpError(422, "INVALID_DESTINO", "Destinatário indisponível neste município");
    const data = await prisma.comunicado.create({ data: { ...body, autorId: req.user!.id } });
    res.status(201).json({ data });
  } catch (err) { next(err); }
});
comunicadosRouter.post("/:id/lido", async (req, res, next) => {
  try {
    const item = await prisma.comunicado.findFirst({ where: { id: req.params.id, iniciativa: { municipioId: req.user!.municipioId }, OR: [{ destinatarioId: req.user!.id }, { destinoPapel: req.user!.role }] } });
    if (!item) throw new HttpError(404, "NOT_FOUND", "Aviso não encontrado para este destinatário");
    await prisma.comunicadoLeitura.upsert({ where: { comunicadoId_userId: { comunicadoId: item.id, userId: req.user!.id } }, create: { comunicadoId: item.id, userId: req.user!.id }, update: {} });
    res.json({ ok: true });
  } catch (err) { next(err); }
});
