import { Router } from "express";
import { z } from "zod";
import { prisma } from "@cip/db";
import {
  requireAuth,
  requirePermission,
  assertMunicipioAccess,
} from "../middleware/auth";
import { HttpError } from "../middleware/error";
import { writeAudit } from "../services/audit";

export const modelosRouter = Router();
modelosRouter.use(requireAuth);

modelosRouter.get(
  "/",
  requirePermission("iniciativa:read"),
  async (req, res, next) => {
    try {
      const rows = await prisma.modeloProjeto.findMany({
        where: { municipioId: req.user!.municipioId, ativo: true },
        orderBy: { nome: "asc" },
      });
      res.json({
        data: rows.map((r) => ({
          id: r.id,
          codigo: r.codigo,
          nome: r.nome,
          descricao: r.descricao,
          classificacoesPermitidas: r.classificacoesPermitidas,
        })),
      });
    } catch (err) {
      next(err);
    }
  },
);

modelosRouter.get(
  "/catalogo",
  requirePermission("municipio:manage"),
  async (_req, res, next) => {
    try {
      const rows = await prisma.modeloProjetoCatalogo.findMany({
        where: { ativo: true },
        orderBy: { nome: "asc" },
      });
      res.json({
        data: rows.map((r) => ({
          id: r.id,
          codigo: r.codigo,
          nome: r.nome,
          descricao: r.descricao,
          categoria: r.categoria,
          versao: r.versao,
        })),
      });
    } catch (err) {
      next(err);
    }
  },
);

modelosRouter.get(
  "/:id",
  requirePermission("iniciativa:read"),
  async (req, res, next) => {
    try {
      const row = await prisma.modeloProjeto.findUnique({
        where: { id: req.params.id },
        include: { perguntas: { orderBy: { ordem: "asc" } }, estrutura: true },
      });
      if (!row) throw new HttpError(404, "NOT_FOUND", "Modelo não encontrado");
      await assertMunicipioAccess(req.user!, row.municipioId, "Modelo");
      res.json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);

modelosRouter.post(
  "/ativar/:catalogoId",
  requirePermission("municipio:manage"),
  async (req, res, next) => {
    try {
      const catalogo = await prisma.modeloProjetoCatalogo.findUnique({
        where: { id: req.params.catalogoId },
      });
      if (!catalogo) {
        throw new HttpError(404, "NOT_FOUND", "Catálogo não encontrado");
      }
      const municipioId = req.user!.municipioId;
      const snap = catalogo.snapshot as {
        codigo: string;
        nome: string;
        perguntas: Array<Record<string, unknown>>;
        estrutura: Array<Record<string, unknown>>;
      };

      const existing = await prisma.modeloProjeto.findUnique({
        where: {
          municipioId_codigo: { municipioId, codigo: catalogo.codigo },
        },
      });
      if (existing) {
        res.json({ data: existing, aviso: "Modelo já estava ativado" });
        return;
      }

      const modelo = await prisma.$transaction(async (tx) => {
        const created = await tx.modeloProjeto.create({
          data: {
            municipioId,
            catalogoOrigemId: catalogo.id,
            codigo: catalogo.codigo,
            nome: catalogo.nome,
            descricao: catalogo.descricao,
            classificacoesPermitidas: ["ESTRUTURANTE"],
            snapshot: catalogo.snapshot as object,
          },
        });

        for (const p of snap.perguntas || []) {
          await tx.modeloPergunta.create({
            data: {
              modeloId: created.id,
              codigo: String(p.codigo),
              texto: String(p.texto),
              tipoResposta: String(p.tipoResposta),
              impacto: String(p.impacto),
              obrigatoria: Boolean(p.obrigatoria),
              ordem: Number(p.ordem || 0),
              dependeDeValor: (p.dependeDeValor as object) || undefined,
              opcoes: (p.opcoes as object) || undefined,
              efeitos: (p.efeitos as object) || [],
            },
          });
        }

        const perguntas = await tx.modeloPergunta.findMany({
          where: { modeloId: created.id },
        });
        const byCodigo = Object.fromEntries(perguntas.map((x) => [x.codigo, x]));
        for (const p of snap.perguntas || []) {
          const depCodigo = p.dependeDeCodigo as string | undefined;
          if (!depCodigo || !byCodigo[String(p.codigo)]) continue;
          const dep = byCodigo[depCodigo];
          if (!dep) continue;
          await tx.modeloPergunta.update({
            where: { id: byCodigo[String(p.codigo)].id },
            data: { dependeDePerguntaId: dep.id },
          });
        }

        for (const e of snap.estrutura || []) {
          await tx.modeloEstruturaItem.create({
            data: {
              modeloId: created.id,
              codigo: String(e.codigo),
              nivel: String(e.nivel),
              parentCodigo: (e.parentCodigo as string) || null,
              nome: String(e.nome),
              indicador: (e.indicador as string) || null,
              alvo: (e.alvo as string) || null,
              ordem: Number(e.ordem || 0),
              sempreIncluir: Boolean(e.sempreIncluir),
            },
          });
        }

        return created;
      });

      await writeAudit({
        user: req.user,
        action: "CREATE",
        entity: "ModeloProjeto",
        entityId: modelo.id,
        after: modelo,
        ip: req.ip,
      });

      res.status(201).json({ data: modelo });
    } catch (err) {
      next(err);
    }
  },
);

const perguntaSchema = z.object({
  codigo: z.string().min(2),
  texto: z.string().min(3),
  tipoResposta: z.string(),
  impacto: z.enum(["BLOQUEANTE", "CONDICIONAL", "INFORMATIVA"]),
  obrigatoria: z.boolean().optional(),
  ordem: z.number().int().optional(),
  efeitos: z.any().optional(),
  opcoes: z.array(z.string()).optional(),
});

modelosRouter.post(
  "/:id/perguntas",
  requirePermission("municipio:manage"),
  async (req, res, next) => {
    try {
      const modelo = await prisma.modeloProjeto.findUnique({
        where: { id: req.params.id },
      });
      if (!modelo) throw new HttpError(404, "NOT_FOUND", "Modelo não encontrado");
      await assertMunicipioAccess(req.user!, modelo.municipioId, "Modelo");
      const body = perguntaSchema.parse(req.body);
      const row = await prisma.modeloPergunta.create({
        data: {
          modeloId: modelo.id,
          codigo: body.codigo,
          texto: body.texto,
          tipoResposta: body.tipoResposta,
          impacto: body.impacto,
          obrigatoria: body.obrigatoria ?? false,
          ordem: body.ordem ?? 0,
          efeitos: body.efeitos ?? [],
          opcoes: body.opcoes,
        },
      });
      res.status(201).json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);
