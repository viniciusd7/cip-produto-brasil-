import { avisarSecretaria } from "../services/notifications";
import { Router } from "express";
import multer from "multer";
import path from "path";
import { z } from "zod";
import { prisma } from "@cip/db";
import {
  assertMunicipioAccess,
  requireAuth,
  requirePermission,
} from "../middleware/auth";
import { HttpError } from "../middleware/error";
import { writeAudit } from "../services/audit";
import { prazoStatus } from "../services/prazo";
import {
  inferTipoFromMime,
  isAllowedMime,
  localStorage,
  MAX_UPLOAD_BYTES,
} from "../services/storage";
import { assertExecucaoPermitida } from "../services/wizard-persist";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

export const iniciativasRouter = Router();

iniciativasRouter.use(requireAuth);

iniciativasRouter.get(
  "/",
  requirePermission("iniciativa:read"),
  async (req, res, next) => {
    try {
      const municipioId = req.user!.municipioId;
      const q = String(req.query.q || "").trim();
      const secretariaId = String(req.query.secretariaId || "").trim();
      const ciclo = String(req.query.ciclo || "").trim();

      const rows = await prisma.iniciativa.findMany({
        where: {
          municipioId,
          ...(secretariaId ? { secretariaPrincipalId: secretariaId } : {}),
          ...(ciclo ? { ciclo } : {}),
          ...(q
            ? {
                OR: [
                  { nome: { contains: q } },
                  { codigo: { contains: q } },
                  { origem: { contains: q } },
                ],
              }
            : {}),
        },
        include: {
          secretariaPrincipal: true,
          impedimentos: {
            where: { status: { in: ["ABERTO", "EM_ENCAMINHAMENTO"] } },
          },
          marcos: true,
        },
        orderBy: [{ estruturante: "desc" }, { atualizadoEm: "desc" }],
      });

      res.json({
        data: rows.map((r) => ({
          id: r.id,
          codigo: r.codigo,
          nome: r.nome,
          ciclo: r.ciclo,
          secretariaPrincipal: r.secretariaPrincipal.nome,
          classificacaoPrincipal: r.classificacaoPrincipal,
          bloqueioLabel: r.bloqueioLabel,
          responsavel: r.responsavel,
          origem: r.origem,
          atualizadoEm: r.atualizadoEm.toISOString(),
          fonte: r.fonte,
          dataReferencia: r.dataReferencia?.toISOString() ?? null,
          pendencias: r.impedimentos.length,
          prazoDerivado: (() => {
            const statuses = r.marcos.map((m) =>
              prazoStatus(m, r.dataReferencia),
            );
            if (statuses.includes("VENCIDO")) return "VENCIDO";
            if (statuses.includes("SEM_PRAZO")) return "SEM_PRAZO";
            if (statuses.every((s) => s === "CONCLUIDO") && statuses.length)
              return "CONCLUIDO";
            return "NO_PRAZO";
          })(),
        })),
        meta: {
          total: rows.length,
          dataReferencia: rows[0]?.dataReferencia?.toISOString(),
          fonte: rows[0]?.fonte,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

iniciativasRouter.get(
  "/:id",
  requirePermission("iniciativa:read"),
  async (req, res, next) => {
    try {
      const item = await prisma.iniciativa.findUnique({
        where: { id: req.params.id },
        include: {
          secretariaPrincipal: true,
          metaEstrategica: true,
          secretarias: { include: { secretaria: true } },
          compromissos: { include: { compromisso: true } },
          equipamentos: { include: { equipamento: true } },
          metasExecucao: {
            include: {
              marcos: {
                include: { reprogramacoes: true, subtarefas: true },
                orderBy: { ordem: "asc" },
              },
            },
            orderBy: { ordem: "asc" },
          },
          marcos: {
            include: { reprogramacoes: true, subtarefas: true, metaExecucao: true },
            orderBy: { ordem: "asc" },
          },
          verificacoes: { include: { tipo: true } },
          respostasViabilidade: { orderBy: { createdAt: "asc" } },
          impedimentos: { include: { decisoes: true } },
          decisoes: true,
          evidencias: {
            include: {
              validacoes: {
                include: {
                  validador: { select: { id: true, name: true } },
                },
                orderBy: { createdAt: "desc" },
              },
              marco: { select: { id: true, codigo: true, descricao: true } },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!item) throw new HttpError(404, "NOT_FOUND", "Iniciativa não encontrada");
      await assertMunicipioAccess(req.user!, item.municipioId, "Iniciativa");

      res.json({
        data: {
          ...item,
          bloqueioLabel: item.bloqueioLabel,
          bloqueiosAtivos: item.bloqueiosAtivos,
          classificacaoPrincipal: item.classificacaoPrincipal,
          vinculoPlanoGoverno: item.vinculoPlanoGoverno,
          marcos: item.marcos.map((m) => ({
            ...m,
            prazoStatus: prazoStatus(m, item.dataReferencia),
          })),
          metasExecucao: item.metasExecucao.map((me) => ({
            ...me,
            marcos: me.marcos.map((m) => ({
              ...m,
              prazoStatus: prazoStatus(m, item.dataReferencia),
            })),
          })),
        },
        meta: {
          dataReferencia: item.dataReferencia?.toISOString(),
          fonte: item.fonte,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

const createSchema = z.object({
  codigo: z.string().min(2),
  nome: z.string().min(3),
  descricao: z.string().optional(),
  secretariaPrincipalId: z.string().min(1),
  origem: z.string().optional(),
  responsavel: z.string().optional(),
  tipo: z.string().optional(),
  estruturante: z.boolean().optional(),
  metaEstrategicaId: z.string().optional(),
  compromissoIds: z.array(z.string()).optional(),
  secretariaIds: z.array(z.string()).optional(),
});

iniciativasRouter.post(
  "/",
  requirePermission("iniciativa:write"),
  async (req, res, next) => {
    try {
      const body = createSchema.parse(req.body);
      const municipioId = req.user!.municipioId;

      // Todas as referências recebidas no cadastro precisam pertencer ao
      // mesmo município do usuário. Sem essa checagem, um operador poderia
      // vincular uma secretaria, meta ou compromisso de outra prefeitura.
      const [secretariaPrincipal, meta, secretarias, compromissos] =
        await Promise.all([
          prisma.secretaria.findFirst({
            where: { id: body.secretariaPrincipalId, municipioId, active: true },
          }),
          body.metaEstrategicaId
            ? prisma.metaEstrategica.findFirst({
                where: {
                  id: body.metaEstrategicaId,
                  plano: { municipioId },
                },
              })
            : Promise.resolve(null),
          body.secretariaIds?.length
            ? prisma.secretaria.findMany({
                where: {
                  id: { in: body.secretariaIds },
                  municipioId,
                  active: true,
                },
                select: { id: true },
              })
            : Promise.resolve([]),
          body.compromissoIds?.length
            ? prisma.compromisso.findMany({
                where: { id: { in: body.compromissoIds }, municipioId },
                select: { id: true },
              })
            : Promise.resolve([]),
        ]);

      if (!secretariaPrincipal) {
        throw new HttpError(
          422,
          "INVALID_SECRETARIA",
          "A secretaria principal não pertence ao município ativo",
        );
      }
      if (body.metaEstrategicaId && !meta) {
        throw new HttpError(
          422,
          "INVALID_META",
          "A meta estratégica não pertence ao plano de governo deste município",
        );
      }
      if (secretarias.length !== new Set(body.secretariaIds || []).size) {
        throw new HttpError(
          422,
          "INVALID_SECRETARIAS",
          "Uma ou mais secretarias vinculadas não pertencem a este município",
        );
      }
      if (compromissos.length !== new Set(body.compromissoIds || []).size) {
        throw new HttpError(
          422,
          "INVALID_COMPROMISSOS",
          "Um ou mais compromissos vinculados não pertencem a este município",
        );
      }

      const correlacionadas = (body.secretariaIds || []).filter(
        (id) => id !== body.secretariaPrincipalId,
      );

      const created = await prisma.iniciativa.create({
        data: {
          municipioId,
          secretariaPrincipalId: body.secretariaPrincipalId,
          metaEstrategicaId: body.metaEstrategicaId,
          codigo: body.codigo,
          nome: body.nome,
          descricao: body.descricao,
          origem: body.origem || "CADASTRO_MANUAL",
          responsavel: body.responsavel || secretariaPrincipal.titularNome || undefined,
          tipo: body.tipo,
          estruturante: body.estruturante ?? false,
          criadoPorId: req.user!.id,
          fonte: "Cadastro manual CIP",
          dataReferencia: new Date(),
          secretarias: correlacionadas.length
            ? {
                create: correlacionadas.map((id) => ({
                  secretariaId: id,
                  papel: "CORRESPONSAVEL",
                  responsavel: undefined,
                })),
              }
            : undefined,
          compromissos: body.compromissoIds?.length
            ? {
                create: body.compromissoIds.map((id) => ({
                  compromissoId: id,
                  tipoContribuicao: "DIRETA",
                  origemVinculo: "CADASTRO_MANUAL",
                })),
              }
            : undefined,
        },
      });

      await writeAudit({
        user: req.user,
        action: "CREATE",
        entity: "Iniciativa",
        entityId: created.id,
        after: created,
        ip: req.ip,
      });

      res.status(201).json({ data: created });
    } catch (err) {
      next(err);
    }
  },
);

const marcoSchema = z.object({
  codigo: z.string().optional(),
  descricao: z.string().min(3),
  responsavel: z.string().optional(),
  prazoOriginal: z.string().datetime().nullable().optional(),
  ordem: z.number().int().optional(),
  metaExecucaoId: z.string().optional(),
  gravidade: z.enum(["LEVE", "MODERADA", "GRAVE", "CRITICA"]).optional(),
});

iniciativasRouter.post(
  "/:id/marcos",
  requirePermission("marco:write"),
  async (req, res, next) => {
    try {
      const ini = await prisma.iniciativa.findUnique({
        where: { id: req.params.id },
      });
      if (!ini) throw new HttpError(404, "NOT_FOUND", "Iniciativa não encontrada");
      await assertMunicipioAccess(req.user!, ini.municipioId, "Iniciativa");

      const body = marcoSchema.parse(req.body);
      const prazo = body.prazoOriginal ? new Date(body.prazoOriginal) : null;
      const marco = await prisma.marcoEntrega.create({
        data: {
          iniciativaId: ini.id,
          codigo: body.codigo,
          descricao: body.descricao,
          responsavel: body.responsavel,
          prazoOriginal: prazo,
          prazoVigente: prazo,
          ordem: body.ordem ?? 0,
          metaExecucaoId: body.metaExecucaoId,
          gravidade: body.gravidade,
        },
      });

      await writeAudit({
        user: req.user,
        action: "CREATE",
        entity: "MarcoEntrega",
        entityId: marco.id,
        after: marco,
        ip: req.ip,
      });

      res.status(201).json({ data: marco });
    } catch (err) {
      next(err);
    }
  },
);

const reprogSchema = z.object({
  dataNova: z.string().datetime({ offset: true }),
  motivo: z.string().min(5),
  autorizacao: z.string().optional(),
});

iniciativasRouter.post("/marcos/:marcoId/prazo-inicial", requirePermission("marco:write"), async (req, res, next) => {
  try {
    const body = z.object({ dataNova: z.string().datetime({ offset: true }) }).parse(req.body);
    const marco = await prisma.marcoEntrega.findUnique({ where: { id: req.params.marcoId }, include: { iniciativa: true } });
    if (!marco) throw new HttpError(404, "NOT_FOUND", "Tarefa não encontrada");
    await assertMunicipioAccess(req.user!, marco.iniciativa.municipioId);
    const prazo = new Date(body.dataNova);
    if (prazo.getTime() < Date.now() || marco.concluidoEm) throw new HttpError(422, "INVALID_DATA", "Defina uma data futura para uma tarefa aberta");
    await prisma.$transaction(async (tx) => {
      const result = await tx.marcoEntrega.updateMany({ where: { id: marco.id, prazoOriginal: null, prazoVigente: null, concluidoEm: null }, data: { prazoOriginal: prazo, prazoVigente: prazo } });
      if (result.count !== 1) throw new HttpError(409, "PRAZO_EXISTENTE", "Esta tarefa já possui prazo. Use reprogramar.");
      await avisarSecretaria(marco.iniciativaId, `Prazo definido para ${marco.descricao}: ${prazo.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}. Responsável: ${marco.responsavel || "a definir"}.`, "PRAZO", req.user!.id, tx);
    });
    res.status(201).json({ ok: true });
  } catch (err) { next(err); }
});

iniciativasRouter.post(
  "/marcos/:marcoId/reprogramar",
  requirePermission("marco:write"),
  async (req, res, next) => {
    try {
      const marco = await prisma.marcoEntrega.findUnique({
        where: { id: req.params.marcoId },
        include: { iniciativa: true },
      });
      if (!marco) throw new HttpError(404, "NOT_FOUND", "Marco não encontrado");
      await assertMunicipioAccess(
        req.user!,
        marco.iniciativa.municipioId,
        "MarcoEntrega",
      );

      const body = reprogSchema.parse(req.body);
      const dataNova = new Date(body.dataNova);
      if (!marco.prazoVigente || marco.concluidoEm) throw new HttpError(422, "INVALID_REPROGRAMACAO", "Defina o primeiro prazo no cadastro. Tarefas concluídas não podem ser reprogramadas.");
      if (dataNova.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) === marco.prazoVigente.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) || dataNova.getTime() < Date.now()) throw new HttpError(422, "INVALID_DATA", "Informe uma nova data futura, diferente da atual");

      const [reprog, updated] = await prisma.$transaction(async (tx) => {
        const changed = await tx.marcoEntrega.updateMany({ where: { id: marco.id, prazoVigente: marco.prazoVigente, concluidoEm: null }, data: { prazoVigente: dataNova } });
        if (changed.count !== 1) throw new HttpError(409, "PRAZO_ALTERADO", "A tarefa foi atualizada por outra pessoa. Recarregue antes de reprogramar.");
        const reprog = await tx.reprogramacao.create({
          data: {
            marcoId: marco.id,
            dataAnterior: marco.prazoVigente,
            dataNova,
            motivo: body.motivo,
            autorId: req.user!.id,
            autorizacao: body.autorizacao,
          },
        });
        const updated = await tx.marcoEntrega.update({
          where: { id: marco.id },
          data: {
            // prazoOriginal NUNCA é sobrescrito
            prazoVigente: dataNova,
          },
        });
        await avisarSecretaria(marco.iniciativaId, `Tarefa reprogramada: ${marco.descricao}. Prazo anterior: ${marco.prazoVigente!.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}. Novo prazo: ${dataNova.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}. Motivo: ${body.motivo}. Providência: acompanhar a nova entrega com ${marco.responsavel || "a equipe"}.`, "REPROGRAMACAO", req.user!.id, tx);
        return [reprog, updated] as const;
      });

      await writeAudit({
        user: req.user,
        action: "REPROGRAMAR",
        entity: "MarcoEntrega",
        entityId: marco.id,
        before: { prazoOriginal: marco.prazoOriginal, prazoVigente: marco.prazoVigente },
        after: { prazoOriginal: updated.prazoOriginal, prazoVigente: updated.prazoVigente, reprog },
        ip: req.ip,
      });

      res.status(201).json({
        data: {
          marco: updated,
          reprogramacao: reprog,
          aviso:
            "Prazo original preservado. Histórico de atraso permanece auditável.",
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

const verificacaoSchema = z.object({
  tipoVerificacaoId: z.string(),
  aplicabilidade: z.enum(["SIM", "NAO", "A_AVALIAR"]),
  situacao: z.enum([
    "NAO_INICIADA",
    "EM_ANALISE",
    "ATENDIDA",
    "PENDENTE",
    "DISPENSADA_COM_FUNDAMENTO",
  ]),
  responsavel: z.string().optional(),
  justificativa: z.string().optional(),
  documentoFonte: z.string().optional(),
  efeitoNoAvanco: z
    .enum(["INFORMATIVO", "REQUER_PROVIDENCIA", "RESTRICAO_VALIDADA"])
    .optional(),
  proximaAcao: z.string().optional(),
});

iniciativasRouter.post(
  "/:id/verificacoes",
  requirePermission("iniciativa:write"),
  async (req, res, next) => {
    try {
      const ini = await prisma.iniciativa.findUnique({
        where: { id: req.params.id },
      });
      if (!ini) throw new HttpError(404, "NOT_FOUND", "Iniciativa não encontrada");
      await assertMunicipioAccess(req.user!, ini.municipioId, "Iniciativa");
      const body = verificacaoSchema.parse(req.body);

      const row = await prisma.verificacao.upsert({
        where: {
          iniciativaId_tipoVerificacaoId: {
            iniciativaId: ini.id,
            tipoVerificacaoId: body.tipoVerificacaoId,
          },
        },
        update: body,
        create: { iniciativaId: ini.id, ...body },
        include: { tipo: true },
      });

      await writeAudit({
        user: req.user,
        action: "UPSERT",
        entity: "Verificacao",
        entityId: row.id,
        after: row,
        ip: req.ip,
      });

      res.status(201).json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);

const impedimentoSchema = z.object({
  tipo: z.string().optional(),
  descricao: z.string().min(5),
  gravidade: z.enum(["BAIXA", "MEDIA", "ALTA"]).optional(),
  responsavel: z.string().optional(),
  proximoPasso: z.string().optional(),
  prazo: z.string().datetime().optional(),
  marcoId: z.string().optional(),
});

iniciativasRouter.post(
  "/:id/impedimentos",
  requirePermission("iniciativa:write"),
  async (req, res, next) => {
    try {
      const ini = await prisma.iniciativa.findUnique({
        where: { id: req.params.id },
      });
      if (!ini) throw new HttpError(404, "NOT_FOUND", "Iniciativa não encontrada");
      await assertMunicipioAccess(req.user!, ini.municipioId, "Iniciativa");
      const body = impedimentoSchema.parse(req.body);

      if (body.marcoId) {
        const marco = await prisma.marcoEntrega.findFirst({
          where: { id: body.marcoId, iniciativaId: ini.id },
        });
        if (!marco) {
          throw new HttpError(
            422,
            "INVALID_MARCO",
            "O marco informado não pertence a esta iniciativa",
          );
        }
      }

      const row = await prisma.impedimento.create({
        data: {
          iniciativaId: ini.id,
          tipo: body.tipo,
          descricao: body.descricao,
          gravidade: body.gravidade || "MEDIA",
          responsavel: body.responsavel,
          proximoPasso: body.proximoPasso,
          prazo: body.prazo ? new Date(body.prazo) : null,
          marcoId: body.marcoId,
          status: "ABERTO",
        },
      });

      await writeAudit({
        user: req.user,
        action: "CREATE",
        entity: "Impedimento",
        entityId: row.id,
        after: row,
        ip: req.ip,
      });

      res.status(201).json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);

const decisaoSchema = z.object({
  descricao: z.string().min(5),
  responsavel: z.string().optional(),
  prazo: z.string().datetime().optional(),
  impedimentoId: z.string().optional(),
  status: z.enum(["ABERTA", "EM_ANDAMENTO", "CONCLUIDA", "CANCELADA"]).optional(),
});

iniciativasRouter.post(
  "/:id/decisoes",
  requirePermission("iniciativa:write"),
  async (req, res, next) => {
    try {
      const ini = await prisma.iniciativa.findUnique({
        where: { id: req.params.id },
      });
      if (!ini) throw new HttpError(404, "NOT_FOUND", "Iniciativa não encontrada");
      await assertMunicipioAccess(req.user!, ini.municipioId, "Iniciativa");
      const body = decisaoSchema.parse(req.body);

      if (body.impedimentoId) {
        const impedimento = await prisma.impedimento.findFirst({
          where: { id: body.impedimentoId, iniciativaId: ini.id },
        });
        if (!impedimento) {
          throw new HttpError(
            422,
            "INVALID_IMPEDIMENTO",
            "O impedimento informado não pertence a esta iniciativa",
          );
        }
      }

      const row = await prisma.decisaoProvidencia.create({
        data: {
          iniciativaId: ini.id,
          descricao: body.descricao,
          responsavel: body.responsavel,
          prazo: body.prazo ? new Date(body.prazo) : null,
          impedimentoId: body.impedimentoId,
          status: body.status || "ABERTA",
          autorId: req.user!.id,
        },
      });

      await writeAudit({
        user: req.user,
        action: "CREATE",
        entity: "DecisaoProvidencia",
        entityId: row.id,
        after: row,
        ip: req.ip,
      });

      res.status(201).json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);

const evidenciaSchema = z.object({
  titulo: z.string().min(3),
  descricao: z.string().min(3, "Descreva o que foi feito"),
  tipo: z.enum(["FOTO", "DOCUMENTO", "LINK"]).optional(),
  urlOuArquivo: z.string().optional(),
  fonte: z.string().optional(),
  marcoId: z.string().optional(),
});

iniciativasRouter.post(
  "/:id/evidencias",
  requirePermission("iniciativa:write"),
  upload.single("arquivo"),
  async (req, res, next) => {
    try {
      const ini = await prisma.iniciativa.findUnique({
        where: { id: req.params.id },
      });
      if (!ini) throw new HttpError(404, "NOT_FOUND", "Iniciativa não encontrada");
      await assertMunicipioAccess(req.user!, ini.municipioId, "Iniciativa");

      const rawBody = {
        titulo: String(req.body.titulo || ""),
        descricao: String(req.body.descricao || ""),
        tipo: req.body.tipo || undefined,
        urlOuArquivo: req.body.urlOuArquivo || undefined,
        fonte: req.body.fonte || undefined,
        marcoId: req.body.marcoId || undefined,
      };
      const body = evidenciaSchema.parse(rawBody);

      if (body.marcoId) {
        const marco = await prisma.marcoEntrega.findFirst({
          where: { id: body.marcoId, iniciativaId: ini.id },
        });
        if (!marco) {
          throw new HttpError(
            422,
            "INVALID_MARCO",
            "O marco informado não pertence a esta iniciativa",
          );
        }
      }

      let storedPath: string | undefined;
      let mimeType: string | undefined;
      let tamanhoBytes: number | undefined;
      let arquivoNome: string | undefined;
      let tipo = body.tipo;

      const file = req.file;
      if (file) {
        if (!isAllowedMime(file.mimetype)) {
          throw new HttpError(
            422,
            "INVALID_FILE",
            "Arquivo não permitido. Use imagem, PDF ou Word.",
          );
        }
        const stored = await localStorage.save(
          file.buffer,
          file.originalname,
          file.mimetype,
        );
        storedPath = stored.relativePath;
        mimeType = stored.mimeType;
        tamanhoBytes = stored.size;
        arquivoNome = stored.originalName;
        if (!tipo) tipo = inferTipoFromMime(file.mimetype);
      } else if (body.urlOuArquivo) {
        if (!tipo) tipo = "LINK";
      }

      const row = await prisma.$transaction(async (tx) => {
        const evidencia = await tx.evidencia.create({
        data: {
          iniciativaId: ini.id,
          titulo: body.titulo,
          descricao: body.descricao,
          tipo: tipo || null,
          urlOuArquivo: storedPath || body.urlOuArquivo || null,
          mimeType: mimeType || null,
          tamanhoBytes: tamanhoBytes ?? null,
          arquivoNome: arquivoNome || null,
          fonte: body.fonte,
          marcoId: body.marcoId,
          autorNome: req.user!.name,
          status: "A_VERIFICAR",
        },
      });
        await avisarSecretaria(ini.id, `Nova evidência: ${body.titulo}. Providência: verificar a entrega registrada por ${req.user!.name} e aprovar ou solicitar correção.`, "EVIDENCIA", req.user!.id, tx);
        return evidencia;
      });

      await writeAudit({
        user: req.user,
        action: "CREATE",
        entity: "Evidencia",
        entityId: row.id,
        after: row,
        ip: req.ip,
      });

      res.status(201).json({
        data: row,
        aviso:
          "Evidência registrada como declaração. Não conta como entrega comprovada até validação.",
      });
    } catch (err) {
      next(err);
    }
  },
);

const validarSchema = z.object({
  status: z.enum(["VERIFICADA", "REJEITADA"]),
  parecer: z.string().optional(),
  concluirMarco: z.boolean().optional(),
  atualizarIndicador: z
    .object({
      metaExecucaoId: z.string(),
      valorTexto: z.string().min(1),
    })
    .optional(),
});

iniciativasRouter.get(
  "/evidencias/:evidenciaId/arquivo",
  requirePermission("iniciativa:read"),
  async (req, res, next) => {
    try {
      const evidencia = await prisma.evidencia.findUnique({
        where: { id: req.params.evidenciaId },
        include: { iniciativa: true },
      });
      if (!evidencia)
        throw new HttpError(404, "NOT_FOUND", "Evidência não encontrada");
      await assertMunicipioAccess(
        req.user!,
        evidencia.iniciativa.municipioId,
        "Evidencia",
      );

      if (
        !evidencia.urlOuArquivo ||
        evidencia.urlOuArquivo.startsWith("http://") ||
        evidencia.urlOuArquivo.startsWith("https://")
      ) {
        throw new HttpError(404, "NO_FILE", "Esta evidência não tem arquivo local");
      }

      const abs = localStorage.absolutePath(evidencia.urlOuArquivo);
      if (!(await localStorage.exists(evidencia.urlOuArquivo))) {
        throw new HttpError(404, "FILE_MISSING", "Arquivo não encontrado no storage");
      }

      res.setHeader(
        "Content-Type",
        evidencia.mimeType || "application/octet-stream",
      );
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${encodeURIComponent(evidencia.arquivoNome || path.basename(abs))}"`,
      );
      res.sendFile(abs);
    } catch (err) {
      next(err);
    }
  },
);

iniciativasRouter.post(
  "/evidencias/:evidenciaId/validar",
  requirePermission("evidencia:validate"),
  async (req, res, next) => {
    try {
      const evidencia = await prisma.evidencia.findUnique({
        where: { id: req.params.evidenciaId },
        include: {
          iniciativa: true,
          marco: { include: { metaExecucao: true } },
        },
      });
      if (!evidencia)
        throw new HttpError(404, "NOT_FOUND", "Evidência não encontrada");
      await assertMunicipioAccess(
        req.user!,
        evidencia.iniciativa.municipioId,
        "Evidencia",
      );
      const body = validarSchema.parse(req.body);

      const result = await prisma.$transaction(async (tx) => {
        const parecerParts = [body.parecer?.trim()].filter(Boolean) as string[];
        if (body.atualizarIndicador?.valorTexto) {
          parecerParts.push(
            `Indicador atualizado: ${body.atualizarIndicador.valorTexto}`,
          );
        }
        const parecer = parecerParts.join("\n") || null;

        const validacao = await tx.validacaoEvidencia.create({
          data: {
            evidenciaId: evidencia.id,
            validadorId: req.user!.id,
            status: body.status,
            parecer,
          },
        });

        const updated = await tx.evidencia.update({
          where: { id: evidencia.id },
          data: { status: body.status },
        });

        let marcoConcluido: { id: string } | null = null;
        let metaAtualizada: { id: string; valorAtual: string | null } | null =
          null;

        if (body.status === "VERIFICADA") {
          if (body.concluirMarco && evidencia.marcoId) {
            await tx.marcoEntrega.update({
              where: { id: evidencia.marcoId },
              data: { concluidoEm: new Date() },
            });
            await tx.subtarefa.updateMany({
              where: { marcoId: evidencia.marcoId, concluida: false },
              data: { concluida: true },
            });
            marcoConcluido = { id: evidencia.marcoId };
          }

          if (body.atualizarIndicador) {
            const metaId =
              body.atualizarIndicador.metaExecucaoId ||
              evidencia.marco?.metaExecucaoId;
            if (metaId) {
              const meta = await tx.metaExecucao.findFirst({
                where: {
                  id: metaId,
                  iniciativaId: evidencia.iniciativaId,
                },
              });
              if (!meta) {
                throw new HttpError(
                  422,
                  "INVALID_META",
                  "Meta de execução inválida para esta evidência",
                );
              }
              metaAtualizada = await tx.metaExecucao.update({
                where: { id: meta.id },
                data: { valorAtual: body.atualizarIndicador.valorTexto },
                select: { id: true, valorAtual: true },
              });
            }
          }
        }

        const origem = await tx.auditLog.findFirst({ where: { entity: "Evidencia", entityId: evidencia.id, action: "CREATE", municipioId: req.user!.municipioId }, orderBy: { createdAt: "asc" } });
        await tx.comunicado.create({ data: { iniciativaId: evidencia.iniciativaId, autorId: req.user!.id, destinatarioId: origem?.actorId || null, destinoPapel: origem?.actorId ? null : "analista", tipo: "VALIDACAO", texto: `Evidência ${body.status === "VERIFICADA" ? "aprovada" : "devolvida para revisão"}: ${evidencia.titulo}. ${parecer || "Consulte a validação no projeto."}` } });
        return { validacao, updated, marcoConcluido, metaAtualizada };
      });

      await writeAudit({
        user: req.user,
        action: "VALIDATE",
        entity: "Evidencia",
        entityId: evidencia.id,
        before: { status: evidencia.status },
        after: {
          status: result.updated.status,
          validacao: result.validacao,
          marcoConcluido: result.marcoConcluido,
          metaAtualizada: result.metaAtualizada,
        },
        ip: req.ip,
      });

      res.json({
        data: {
          evidencia: result.updated,
          validacao: result.validacao,
          marcoConcluido: result.marcoConcluido,
          metaAtualizada: result.metaAtualizada,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

const metaExecSchema = z.object({
  codigo: z.string().optional(),
  nome: z.string().min(3),
  indicador: z.string().optional(),
  criterio: z.string().optional(),
  alvo: z.string().optional(),
  unidade: z.string().optional(),
  responsavel: z.string().optional(),
  prazo: z.string().datetime().optional(),
  ordem: z.number().int().optional(),
  status: z.string().optional(),
});

iniciativasRouter.post(
  "/:id/metas-execucao",
  requirePermission("iniciativa:write"),
  async (req, res, next) => {
    try {
      const ini = await prisma.iniciativa.findUnique({
        where: { id: req.params.id },
      });
      if (!ini) throw new HttpError(404, "NOT_FOUND", "Iniciativa não encontrada");
      await assertMunicipioAccess(req.user!, ini.municipioId, "Iniciativa");
      const body = metaExecSchema.parse(req.body);

      if (
        ini.estruturante &&
        ini.ciclo === "EM_ACOMPANHAMENTO" &&
        !ini.metaEstrategicaId
      ) {
        throw new HttpError(
          400,
          "META_ESTRATEGICA_REQUIRED",
          "Projeto estruturante em acompanhamento exige Meta Estratégica vinculada",
        );
      }

      const row = await prisma.metaExecucao.create({
        data: {
          iniciativaId: ini.id,
          codigo: body.codigo,
          nome: body.nome,
          indicador: body.indicador,
          criterio: body.criterio,
          alvo: body.alvo,
          unidade: body.unidade,
          responsavel: body.responsavel,
          prazo: body.prazo ? new Date(body.prazo) : null,
          ordem: body.ordem ?? 0,
          status: body.status || "EM_ANDAMENTO",
        },
      });

      await writeAudit({
        user: req.user,
        action: "CREATE",
        entity: "MetaExecucao",
        entityId: row.id,
        after: row,
        ip: req.ip,
      });

      res.status(201).json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);

const subtarefaSchema = z.object({
  descricao: z.string().min(3),
  responsavel: z.string().optional(),
  concluida: z.boolean().optional(),
});

iniciativasRouter.post(
  "/marcos/:marcoId/subtarefas",
  requirePermission("marco:write"),
  async (req, res, next) => {
    try {
      const marco = await prisma.marcoEntrega.findUnique({
        where: { id: req.params.marcoId },
        include: { iniciativa: true },
      });
      if (!marco) throw new HttpError(404, "NOT_FOUND", "Marco não encontrado");
      await assertMunicipioAccess(
        req.user!,
        marco.iniciativa.municipioId,
        "MarcoEntrega",
      );
      if (!assertExecucaoPermitida(marco.iniciativa.ciclo)) {
        throw new HttpError(
          422,
          "BLOQUEADO_PRE_REQUISITO",
          marco.iniciativa.bloqueioLabel ||
            "Projeto aguardando pré-requisito — não é possível avançar a execução",
        );
      }
      const body = subtarefaSchema.parse(req.body);
      const row = await prisma.subtarefa.create({
        data: {
          marcoId: marco.id,
          descricao: body.descricao,
          responsavel: body.responsavel,
          concluida: body.concluida ?? false,
        },
      });
      await writeAudit({
        user: req.user,
        action: "CREATE",
        entity: "Subtarefa",
        entityId: row.id,
        after: row,
        ip: req.ip,
      });
      res.status(201).json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);

iniciativasRouter.patch(
  "/subtarefas/:id",
  requirePermission("marco:write"),
  async (req, res, next) => {
    try {
      const existing = await prisma.subtarefa.findUnique({
        where: { id: req.params.id },
        include: { marco: { include: { iniciativa: true } } },
      });
      if (!existing) throw new HttpError(404, "NOT_FOUND", "Subtarefa não encontrada");
      await assertMunicipioAccess(
        req.user!,
        existing.marco.iniciativa.municipioId,
        "Subtarefa",
      );
      if (
        bodyWouldConclude(req.body) &&
        !assertExecucaoPermitida(existing.marco.iniciativa.ciclo)
      ) {
        throw new HttpError(
          422,
          "BLOQUEADO_PRE_REQUISITO",
          existing.marco.iniciativa.bloqueioLabel ||
            "Projeto aguardando pré-requisito — não é possível concluir subtarefas",
        );
      }
      const body = subtarefaSchema.partial().parse(req.body);
      const row = await prisma.subtarefa.update({
        where: { id: existing.id },
        data: body,
      });
      res.json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);

function bodyWouldConclude(body: unknown) {
  if (!body || typeof body !== "object") return false;
  return (body as { concluida?: boolean }).concluida === true;
}


/**
 * Edição do projeto depois da criação: responsável e secretarias envolvidas.
 * Responsável vem da equipe da pasta principal ou de uma correlacionada.
 */
const vinculosSchema = z.object({
  responsavelPessoaId: z.string().nullable().optional(),
  responsavel: z.string().max(200).nullable().optional(),
  secretariaIds: z.array(z.string()).optional(),
});

iniciativasRouter.patch(
  "/:id",
  requirePermission("iniciativa:write"),
  async (req, res, next) => {
    try {
      const body = vinculosSchema.parse(req.body);
      const ini = await prisma.iniciativa.findUnique({
        where: { id: req.params.id },
        include: { secretarias: { select: { secretariaId: true } } },
      });
      if (!ini) throw new HttpError(404, "NOT_FOUND", "Iniciativa não encontrada");
      await assertMunicipioAccess(req.user!, ini.municipioId, "Iniciativa");

      const correlatas =
        body.secretariaIds !== undefined
          ? [...new Set(body.secretariaIds)].filter(
              (id) => id !== ini.secretariaPrincipalId,
            )
          : ini.secretarias.map((s) => s.secretariaId);

      if (body.secretariaIds !== undefined && correlatas.length) {
        const encontradas = await prisma.secretaria.findMany({
          where: { id: { in: correlatas }, municipioId: ini.municipioId, active: true },
          select: { id: true },
        });
        if (encontradas.length !== correlatas.length) {
          throw new HttpError(
            422,
            "INVALID_SECRETARIAS",
            "Uma ou mais secretarias correlacionadas não pertencem a este município",
          );
        }
      }

      const data: Record<string, unknown> = {};
      if (body.responsavelPessoaId !== undefined) {
        if (body.responsavelPessoaId) {
          const pessoa = await prisma.secretariaPessoa.findFirst({
            where: {
              id: body.responsavelPessoaId,
              secretariaId: { in: [ini.secretariaPrincipalId, ...correlatas] },
              ativo: true,
            },
          });
          if (!pessoa) {
            throw new HttpError(
              422,
              "INVALID_RESPONSAVEL",
              "Responsável não pertence às secretarias envolvidas no projeto",
            );
          }
          data.responsavelPessoaId = pessoa.id;
          data.responsavel = pessoa.nome;
        } else {
          data.responsavelPessoaId = null;
          data.responsavel = body.responsavel?.trim() || null;
        }
      } else if (body.responsavel !== undefined) {
        // Nome digitado livremente: desfaz o vínculo com a pessoa cadastrada.
        data.responsavelPessoaId = null;
        data.responsavel = body.responsavel?.trim() || null;
      }

      const updated = await prisma.$transaction(async (tx) => {
        if (body.secretariaIds !== undefined) {
          await tx.iniciativaSecretaria.deleteMany({
            where: {
              iniciativaId: ini.id,
              secretariaId: { notIn: correlatas.length ? correlatas : ["__none__"] },
            },
          });
          if (correlatas.length) {
            await tx.iniciativaSecretaria.createMany({
              data: correlatas.map((secretariaId) => ({
                iniciativaId: ini.id,
                secretariaId,
                papel: "CORRESPONSAVEL",
              })),
              skipDuplicates: true,
            });
          }
        }
        return tx.iniciativa.update({
          where: { id: ini.id },
          data: { ...data, atualizadoEm: new Date() },
        });
      });

      await writeAudit({
        user: req.user,
        action: "UPDATE",
        entity: "Iniciativa",
        entityId: ini.id,
        after: { responsavel: updated.responsavel, secretariaIds: correlatas },
        ip: req.ip,
      });

      res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  },
);

const metaPatchSchema = z.object({
  responsavel: z.string().max(200).nullable().optional(),
});

iniciativasRouter.patch(
  "/metas-execucao/:id",
  requirePermission("iniciativa:write"),
  async (req, res, next) => {
    try {
      const existing = await prisma.metaExecucao.findUnique({
        where: { id: req.params.id },
        include: { iniciativa: { select: { municipioId: true } } },
      });
      if (!existing) throw new HttpError(404, "NOT_FOUND", "Meta não encontrada");
      await assertMunicipioAccess(
        req.user!,
        existing.iniciativa.municipioId,
        "MetaExecucao",
      );
      const body = metaPatchSchema.parse(req.body);
      const row = await prisma.metaExecucao.update({
        where: { id: existing.id },
        data: { responsavel: body.responsavel?.trim() || null },
      });
      await writeAudit({
        user: req.user,
        action: "UPDATE",
        entity: "MetaExecucao",
        entityId: row.id,
        after: { responsavel: row.responsavel },
        ip: req.ip,
      });
      res.json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);

const marcoPatchSchema = z.object({
  responsavel: z.string().max(200).nullable().optional(),
  descricao: z.string().min(3).optional(),
});

iniciativasRouter.patch(
  "/marcos/:id",
  requirePermission("marco:write"),
  async (req, res, next) => {
    try {
      const existing = await prisma.marcoEntrega.findUnique({
        where: { id: req.params.id },
        include: { iniciativa: { select: { municipioId: true } } },
      });
      if (!existing) throw new HttpError(404, "NOT_FOUND", "Tarefa não encontrada");
      await assertMunicipioAccess(
        req.user!,
        existing.iniciativa.municipioId,
        "MarcoEntrega",
      );
      const body = marcoPatchSchema.parse(req.body);
      const row = await prisma.marcoEntrega.update({
        where: { id: existing.id },
        data: {
          ...(body.descricao !== undefined ? { descricao: body.descricao } : {}),
          ...(body.responsavel !== undefined
            ? { responsavel: body.responsavel?.trim() || null }
            : {}),
        },
      });
      await writeAudit({
        user: req.user,
        action: "UPDATE",
        entity: "MarcoEntrega",
        entityId: row.id,
        after: { responsavel: row.responsavel, descricao: row.descricao },
        ip: req.ip,
      });
      res.json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);
