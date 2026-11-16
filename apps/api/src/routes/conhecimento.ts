import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "@cip/db";
import {
  isKnowledgeDocumentRequired,
  KNOWLEDGE_DOCUMENT_TYPES,
} from "@cip/shared";
import { HttpError } from "../middleware/error";
import { requireAuth, requirePermission } from "../middleware/auth";
import { writeAudit } from "../services/audit";
import { classifyKnowledgeText } from "../services/conhecimento-classificacao";
import {
  deleteKnowledgeFile,
  DOCX_MIME,
  DOC_MIME,
  extractKnowledgeText,
  isKnowledgeFileAllowed,
  PDF_MIME,
  readKnowledgeFile,
  saveKnowledgeFile,
} from "../services/conhecimento-documentos";

export const conhecimentoRouter = Router();
conhecimentoRouter.use(requireAuth);
const MAX_KNOWLEDGE_UPLOAD_BYTES = 4 * 1024 * 1024;

const documentoPublicSelect = {
  id: true,
  municipioId: true,
  tipo: true,
  titulo: true,
  vigencia: true,
  versao: true,
  fonte: true,
  responsavel: true,
  statusConferencia: true,
  arquivoUrl: true,
  arquivoNome: true,
  observacao: true,
  createdAt: true,
  updatedAt: true,
} as const;

const uploadDocumento = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_KNOWLEDGE_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!isKnowledgeFileAllowed(file.originalname, file.mimetype)) {
      callback(
        new HttpError(422, "INVALID_FILE", "Envie um arquivo PDF, DOC ou DOCX válido."),
      );
      return;
    }
    callback(null, true);
  },
});

function parseMultipartDocumento(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  uploadDocumento.single("arquivo")(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === "LIMIT_FILE_SIZE";
      next(
        new HttpError(
          tooLarge ? 413 : 400,
          tooLarge ? "FILE_TOO_LARGE" : "INVALID_MULTIPART",
          tooLarge
            ? "O arquivo deve ter no máximo 4 MB."
            : "O formulário de upload contém campos ou arquivos inválidos.",
        ),
      );
      return;
    }
    next(error);
  });
}

conhecimentoRouter.get(
  "/documentos",
  requirePermission("iniciativa:read"),
  async (req, res, next) => {
    try {
      const municipioId = req.user!.municipioId;
      const docs = await prisma.documentoConhecimento.findMany({
        where: { municipioId },
        orderBy: [{ tipo: "asc" }, { updatedAt: "desc" }],
        select: documentoPublicSelect,
      });
      res.json({
        data: docs,
        meta: {
          alertasOrcamento: [],
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

const docSchema = z.object({
  tipo: z.enum(KNOWLEDGE_DOCUMENT_TYPES),
  titulo: z.string().min(3),
  vigencia: z.string().optional(),
  versao: z.string().optional(),
  fonte: z.string().optional(),
  responsavel: z.string().optional(),
  statusConferencia: z
    .enum(["PENDENTE", "CONFERIDO", "DESATUALIZADO"])
    .optional(),
  arquivoUrl: z.string().url().optional().nullable(),
  observacao: z.string().optional(),
});

const createDocSchema = docSchema.extend({
  tipo: z.enum(["AUTO", ...KNOWLEDGE_DOCUMENT_TYPES]),
});

function assertKnowledgeDocumentFile(tipo: string, hasFile: boolean) {
  if ((tipo === "AUTO" || isKnowledgeDocumentRequired(tipo)) && !hasFile) {
    throw new HttpError(
      422,
      "DOCUMENT_FILE_REQUIRED",
      tipo === "AUTO"
        ? "O arquivo é obrigatório para classificação automática."
        : "O arquivo do Plano de Governo é obrigatório.",
    );
  }
}

conhecimentoRouter.post(
  "/documentos",
  requirePermission("conhecimento:upload"),
  parseMultipartDocumento,
  async (req, res, next) => {
    try {
      const body = createDocSchema.parse(req.body);
      if (
        body.statusConferencia &&
        body.statusConferencia !== "PENDENTE" &&
        !req.user!.permissions.includes("iniciativa:write")
      ) {
        throw new HttpError(403, "FORBIDDEN", "Somente a consultoria pode conferir documentos.");
      }
      const file = req.file;
      assertKnowledgeDocumentFile(body.tipo, Boolean(file));
      const conteudoExtraido = file
        ? await extractKnowledgeText(file.buffer, file.originalname, file.mimetype)
        : undefined;
      let tipo: (typeof KNOWLEDGE_DOCUMENT_TYPES)[number];
      if (body.tipo === "AUTO") {
        if (conteudoExtraido === undefined) {
          throw new HttpError(422, "DOCUMENT_FILE_REQUIRED", "O arquivo é obrigatório para classificação automática.");
        }
        tipo = classifyKnowledgeText(conteudoExtraido);
      } else {
        tipo = body.tipo;
      }
      const storageKey = file
        ? await saveKnowledgeFile(
            file.buffer,
            req.user!.municipioId,
            file.originalname,
            file.mimetype,
          )
        : undefined;

      let doc;
      try {
        doc = await prisma.documentoConhecimento.create({
          data: {
            municipioId: req.user!.municipioId,
            ...body,
            tipo,
            arquivoNome: file?.originalname,
            storageKey,
            conteudoExtraido,
            statusConferencia: body.statusConferencia ?? "PENDENTE",
          },
          select: documentoPublicSelect,
        });
      } catch (error) {
        if (storageKey) await deleteKnowledgeFile(storageKey);
        throw error;
      }

      await writeAudit({
        user: req.user,
        action: "CREATE",
        entity: "DocumentoConhecimento",
        entityId: doc.id,
        after: doc,
        ip: req.ip,
      });
      res.status(201).json({ data: doc });
    } catch (err) {
      next(err);
    }
  },
);

conhecimentoRouter.get(
  "/documentos/:id/arquivo",
  requirePermission("iniciativa:read"),
  async (req, res, next) => {
    try {
      const doc = await prisma.documentoConhecimento.findFirst({
        where: { id: req.params.id, municipioId: req.user!.municipioId },
        select: { storageKey: true, arquivoNome: true },
      });
      if (!doc) throw new HttpError(404, "NOT_FOUND", "Documento não encontrado");
      if (!doc.storageKey || !doc.arquivoNome) {
        throw new HttpError(404, "NO_FILE", "Este documento não possui arquivo anexado.");
      }

      const contents = await readKnowledgeFile(doc.storageKey);
      const name = doc.arquivoNome.toLowerCase();
      const mimeType = name.endsWith(".pdf")
        ? PDF_MIME
        : name.endsWith(".doc") ? DOC_MIME : DOCX_MIME;
      res.setHeader("Content-Type", mimeType);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.attachment(doc.arquivoNome);
      res.send(contents);
    } catch (err) {
      next(err);
    }
  },
);

conhecimentoRouter.get(
  "/documentos/:id/conteudo",
  requirePermission("iniciativa:read"),
  async (req, res, next) => {
    try {
      const doc = await prisma.documentoConhecimento.findFirst({
        where: { id: req.params.id, municipioId: req.user!.municipioId },
        select: { conteudoExtraido: true },
      });
      if (!doc) throw new HttpError(404, "NOT_FOUND", "Documento não encontrado");
      res.json({
        data: {
          texto: doc.conteudoExtraido,
          mensagem: doc.conteudoExtraido
            ? undefined
            : "Nenhum texto foi extraído. O PDF pode ser digitalizado como imagem.",
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

conhecimentoRouter.patch(
  "/documentos/:id",
  requirePermission("iniciativa:write"),
  async (req, res, next) => {
    try {
      const body = docSchema.partial().parse(req.body);
      const existing = await prisma.documentoConhecimento.findFirst({
        where: { id: req.params.id, municipioId: req.user!.municipioId },
        select: documentoPublicSelect,
      });
      if (!existing) throw new HttpError(404, "NOT_FOUND", "Documento não encontrado");
      assertKnowledgeDocumentFile(
        body.tipo ?? existing.tipo,
        Boolean(existing.arquivoNome),
      );
      const doc = await prisma.documentoConhecimento.update({
        where: { id: existing.id },
        data: body,
        select: documentoPublicSelect,
      });
      await writeAudit({
        user: req.user,
        action: "UPDATE",
        entity: "DocumentoConhecimento",
        entityId: doc.id,
        before: existing,
        after: doc,
        ip: req.ip,
      });
      res.json({ data: doc });
    } catch (err) {
      next(err);
    }
  },
);

conhecimentoRouter.get(
  "/sugestoes",
  requirePermission("iniciativa:read"),
  async (req, res, next) => {
    try {
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const data = await prisma.sugestaoIA.findMany({
        where: {
          municipioId: req.user!.municipioId,
          ...(status ? { status } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
);

const sugestaoSchema = z.object({
  entidadeTipo: z.string().min(2),
  entidadeId: z.string().optional(),
  campo: z.string().optional(),
  sugestao: z.string().min(3),
  fonte: z.string().optional(),
  confianca: z.enum(["BAIXA", "MEDIA", "ALTA"]).optional(),
});

conhecimentoRouter.post(
  "/sugestoes",
  requirePermission("iniciativa:write"),
  async (req, res, next) => {
    try {
      const body = sugestaoSchema.parse(req.body);
      const item = await prisma.sugestaoIA.create({
        data: {
          municipioId: req.user!.municipioId,
          entidadeTipo: body.entidadeTipo,
          entidadeId: body.entidadeId,
          campo: body.campo,
          sugestao: body.sugestao,
          fonte: body.fonte ?? "heuristica-cip",
          confianca: body.confianca ?? "BAIXA",
          autorId: req.user!.id,
        },
      });
      res.status(201).json({ data: item });
    } catch (err) {
      next(err);
    }
  },
);

conhecimentoRouter.post(
  "/sugestoes/gerar",
  requirePermission("iniciativa:write"),
  async (req, res, next) => {
    try {
      const municipioId = req.user!.municipioId;
      const meta = await prisma.metaEstrategica.findFirst({
        where: { plano: { municipioId } },
        orderBy: { updatedAt: "desc" },
      });
      if (!meta) {
        throw new HttpError(422, "NO_META", "Cadastre uma Meta Estratégica antes de gerar sugestões");
      }
      const texto = meta.indicador
        ? `Registrar medição periódica para o indicador "${meta.indicador}" da meta "${meta.nome}".`
        : `Definir indicador, linha de base e alvo para a Meta Estratégica "${meta.nome}".`;
      const item = await prisma.sugestaoIA.create({
        data: {
          municipioId,
          entidadeTipo: "META_ESTRATEGICA",
          entidadeId: meta.id,
          campo: meta.indicador ? "medicao" : "indicador",
          sugestao: texto,
          fonte: "heuristica-cip",
          confianca: "BAIXA",
          autorId: req.user!.id,
        },
      });
      res.status(201).json({ data: item });
    } catch (err) {
      next(err);
    }
  },
);

conhecimentoRouter.patch(
  "/sugestoes/:id",
  requirePermission("iniciativa:write"),
  async (req, res, next) => {
    try {
      const body = z
        .object({ status: z.enum(["ACEITA", "REJEITADA"]) })
        .parse(req.body);
      const existing = await prisma.sugestaoIA.findFirst({
        where: { id: req.params.id, municipioId: req.user!.municipioId },
      });
      if (!existing) throw new HttpError(404, "NOT_FOUND", "Sugestão não encontrada");
      const item = await prisma.sugestaoIA.update({
        where: { id: existing.id },
        data: {
          status: body.status,
          decidedById: req.user!.id,
          decidedAt: new Date(),
        },
      });
      res.json({ data: item });
    } catch (err) {
      next(err);
    }
  },
);

const solicitacaoSchema = z.object({
  entidadeTipo: z.string().min(2),
  entidadeId: z.string().min(1),
  tipo: z.enum(["REVISAO", "APROVACAO", "VINCULO"]).optional(),
  justificativa: z.string().min(5),
});

conhecimentoRouter.post(
  "/validacoes",
  requirePermission("iniciativa:write"),
  async (req, res, next) => {
    try {
      const body = solicitacaoSchema.parse(req.body);
      const item = await prisma.solicitacaoValidacao.create({
        data: {
          municipioId: req.user!.municipioId,
          entidadeTipo: body.entidadeTipo,
          entidadeId: body.entidadeId,
          tipo: body.tipo ?? "REVISAO",
          justificativa: body.justificativa,
          autorId: req.user!.id,
        },
      });
      await writeAudit({
        user: req.user,
        action: "CREATE",
        entity: "SolicitacaoValidacao",
        entityId: item.id,
        after: item,
        ip: req.ip,
      });
      res.status(201).json({ data: item });
    } catch (err) {
      next(err);
    }
  },
);

conhecimentoRouter.get(
  "/validacoes",
  requirePermission("iniciativa:read"),
  async (req, res, next) => {
    try {
      const data = await prisma.solicitacaoValidacao.findMany({
        where: { municipioId: req.user!.municipioId },
        include: { decisoes: { orderBy: { createdAt: "desc" } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
);

conhecimentoRouter.post(
  "/validacoes/:id/decidir",
  requirePermission("iniciativa:write"),
  async (req, res, next) => {
    try {
      const body = z
        .object({
          resultado: z.enum(["APROVADA", "REJEITADA", "DEVOLVIDA"]),
          parecer: z.string().min(3),
        })
        .parse(req.body);
      const sol = await prisma.solicitacaoValidacao.findFirst({
        where: { id: req.params.id, municipioId: req.user!.municipioId },
      });
      if (!sol) throw new HttpError(404, "NOT_FOUND", "Solicitação não encontrada");
      if (sol.status !== "ABERTA") {
        throw new HttpError(422, "CLOSED", "Solicitação já decidida");
      }
      const [decisao] = await prisma.$transaction([
        prisma.decisaoValidacao.create({
          data: {
            solicitacaoId: sol.id,
            resultado: body.resultado,
            parecer: body.parecer,
            validadorId: req.user!.id,
          },
        }),
        prisma.solicitacaoValidacao.update({
          where: { id: sol.id },
          data: { status: "DECIDIDA" },
        }),
      ]);
      res.status(201).json({ data: decisao });
    } catch (err) {
      next(err);
    }
  },
);
