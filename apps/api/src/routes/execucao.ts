import { Router } from "express";
import { z } from "zod";
import { prisma, type Prisma } from "@cip/db";
import { HttpError } from "../middleware/error";
import {
  assertIniciativaAccess,
  iniciativaScopeFilter,
  requireAuth,
  requirePermission,
} from "../middleware/auth";
import { writeAudit } from "../services/audit";
import { notificarConsultores, notificarUsuario } from "../services/notifications";
import { assertExecucaoPermitida } from "../services/wizard-persist";

/**
 * Execução pela secretaria: o secretário reprograma (com justificativa) e pede
 * conclusão; o consultor valida a conclusão olhando evidência e justificativa.
 */
export const execucaoRouter = Router();
execucaoRouter.use(requireAuth);

const TZ = { timeZone: "America/Sao_Paulo" } as const;
const dataBr = (d: Date) => d.toLocaleDateString("pt-BR", TZ);

const reprogramarSchema = z.object({
  dataNova: z.string().datetime(),
  motivo: z.string().trim().min(10, "Explique o motivo da reprogramação (mínimo 10 caracteres)"),
});

execucaoRouter.post(
  "/marcos/:id/reprogramar",
  requirePermission("tarefa:solicitar"),
  async (req, res, next) => {
    try {
      const marco = await prisma.marcoEntrega.findUnique({
        where: { id: req.params.id },
        include: { iniciativa: { select: { id: true, codigo: true, nome: true, municipioId: true } } },
      });
      if (!marco) throw new HttpError(404, "NOT_FOUND", "Tarefa não encontrada");
      await assertIniciativaAccess(req.user!, marco.iniciativaId);
      const body = reprogramarSchema.parse(req.body);
      const dataNova = new Date(body.dataNova);
      if (marco.concluidoEm || marco.encerradoSemSolucaoEm) {
        throw new HttpError(422, "TAREFA_ENCERRADA", "Tarefas concluídas ou encerradas não podem ser reprogramadas");
      }
      if (dataNova.getTime() < Date.now() || (marco.prazoVigente && dataBr(dataNova) === dataBr(marco.prazoVigente))) {
        throw new HttpError(422, "INVALID_DATA", "Informe uma nova data futura, diferente da atual");
      }

      const updated = await prisma.$transaction(async (tx) => {
        const changed = await tx.marcoEntrega.updateMany({
          where: { id: marco.id, prazoVigente: marco.prazoVigente, concluidoEm: null },
          data: {
            prazoVigente: dataNova,
            ...(marco.prazoOriginal ? {} : { prazoOriginal: dataNova }),
          },
        });
        if (changed.count !== 1) {
          throw new HttpError(409, "PRAZO_ALTERADO", "A tarefa foi atualizada por outra pessoa. Recarregue a página.");
        }
        await tx.reprogramacao.create({
          data: {
            marcoId: marco.id,
            dataAnterior: marco.prazoVigente,
            dataNova,
            motivo: body.motivo,
            autorId: req.user!.id,
            autorizacao: "SECRETARIA",
          },
        });
        await notificarConsultores(
          {
            municipioId: marco.iniciativa.municipioId,
            tipo: "REPROGRAMACAO",
            titulo: `Tarefa reprogramada por ${req.user!.name}`,
            texto: `${marco.iniciativa.codigo} · ${marco.descricao}. Prazo ${marco.prazoVigente ? dataBr(marco.prazoVigente) : "não definido"} → ${dataBr(dataNova)}. Motivo: ${body.motivo}`,
            link: `/iniciativas/${marco.iniciativaId}?aba=andamento`,
            entidadeTipo: "MARCO",
            entidadeId: marco.id,
          },
          req.user!.id,
          tx,
        );
        return tx.marcoEntrega.findUniqueOrThrow({ where: { id: marco.id } });
      });

      await writeAudit({
        user: req.user,
        action: "REPROGRAMAR",
        entity: "MarcoEntrega",
        entityId: marco.id,
        before: { prazoVigente: marco.prazoVigente },
        after: { prazoVigente: updated.prazoVigente, motivo: body.motivo },
        ip: req.ip,
      });
      res.status(201).json({ data: updated });
    } catch (err) {
      next(err);
    }
  },
);

const solicitacaoSchema = z.object({
  entidadeTipo: z.enum(["MARCO", "SUBTAREFA"]),
  entidadeId: z.string().min(1),
  justificativa: z.string().trim().min(5, "Descreva o que foi entregue"),
  evidenciaId: z.string().optional(),
});

type PayloadConclusao = {
  statusNovo: "CONCLUIDA";
  iniciativaId: string;
  marcoId: string;
  descricao: string;
  evidenciaId?: string | null;
};

async function carregarAlvo(entidadeTipo: "MARCO" | "SUBTAREFA", entidadeId: string) {
  if (entidadeTipo === "MARCO") {
    const marco = await prisma.marcoEntrega.findUnique({
      where: { id: entidadeId },
      include: { iniciativa: { select: { id: true, codigo: true, nome: true, municipioId: true } } },
    });
    if (!marco) throw new HttpError(404, "NOT_FOUND", "Tarefa não encontrada");
    return {
      iniciativa: marco.iniciativa,
      marcoId: marco.id,
      descricao: marco.descricao,
      concluida: Boolean(marco.concluidoEm || marco.encerradoSemSolucaoEm),
    };
  }
  const sub = await prisma.subtarefa.findUnique({
    where: { id: entidadeId },
    include: { marco: { include: { iniciativa: { select: { id: true, codigo: true, nome: true, municipioId: true } } } } },
  });
  if (!sub) throw new HttpError(404, "NOT_FOUND", "Subtarefa não encontrada");
  return {
    iniciativa: sub.marco.iniciativa,
    marcoId: sub.marcoId,
    descricao: `${sub.marco.descricao} › ${sub.descricao}`,
    concluida: sub.concluida,
  };
}

execucaoRouter.post(
  "/solicitacoes",
  requirePermission("tarefa:solicitar"),
  async (req, res, next) => {
    try {
      const body = solicitacaoSchema.parse(req.body);
      const alvo = await carregarAlvo(body.entidadeTipo, body.entidadeId);
      await assertIniciativaAccess(req.user!, alvo.iniciativa.id);
      if (alvo.concluida) throw new HttpError(422, "JA_CONCLUIDA", "Este item já está concluído");
      if (body.evidenciaId) {
        const evidencia = await prisma.evidencia.findFirst({
          where: { id: body.evidenciaId, iniciativaId: alvo.iniciativa.id },
          select: { id: true },
        });
        if (!evidencia) throw new HttpError(422, "INVALID_EVIDENCIA", "A evidência não pertence a este projeto");
      }
      const aberta = await prisma.solicitacaoValidacao.findFirst({
        where: { entidadeTipo: body.entidadeTipo, entidadeId: body.entidadeId, tipo: "CONCLUSAO", status: "ABERTA" },
        select: { id: true },
      });
      if (aberta) throw new HttpError(409, "VALIDACAO_ABERTA", "Já existe um pedido de conclusão aguardando o consultor");

      const payload: PayloadConclusao = {
        statusNovo: "CONCLUIDA",
        iniciativaId: alvo.iniciativa.id,
        marcoId: alvo.marcoId,
        descricao: alvo.descricao,
        evidenciaId: body.evidenciaId ?? null,
      };
      const sol = await prisma.$transaction(async (tx) => {
        const created = await tx.solicitacaoValidacao.create({
          data: {
            municipioId: alvo.iniciativa.municipioId,
            entidadeTipo: body.entidadeTipo,
            entidadeId: body.entidadeId,
            tipo: "CONCLUSAO",
            justificativa: body.justificativa,
            payload: payload as Prisma.InputJsonValue,
            autorId: req.user!.id,
          },
        });
        await notificarConsultores(
          {
            municipioId: alvo.iniciativa.municipioId,
            tipo: "VALIDACAO_PENDENTE",
            titulo: `Conclusão aguardando validação · ${alvo.iniciativa.codigo}`,
            texto: `${req.user!.name} marcou como concluída: ${alvo.descricao}. ${body.evidenciaId ? "Evidência anexada." : "Sem evidência anexada — verifique a justificativa."}`,
            link: "/validacoes",
            entidadeTipo: "SOLICITACAO",
            entidadeId: created.id,
          },
          req.user!.id,
          tx,
        );
        return created;
      });
      await writeAudit({
        user: req.user,
        action: "CREATE",
        entity: "SolicitacaoValidacao",
        entityId: sol.id,
        after: sol,
        ip: req.ip,
      });
      res.status(201).json({ data: sol });
    } catch (err) {
      next(err);
    }
  },
);

execucaoRouter.get(
  "/solicitacoes",
  requirePermission("iniciativa:read"),
  async (req, res, next) => {
    try {
      const user = req.user!;
      const status = typeof req.query.status === "string" ? req.query.status : "ABERTA";
      const rows = await prisma.solicitacaoValidacao.findMany({
        where: {
          municipioId: user.municipioId,
          tipo: "CONCLUSAO",
          ...(status === "TODAS" ? {} : { status }),
          ...(user.role === "gestor" ? { autorId: user.id } : {}),
        },
        include: {
          autor: { select: { id: true, name: true } },
          decisoes: { orderBy: { createdAt: "desc" }, take: 1, include: { validador: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      const payloads = rows.map((r) => (r.payload || {}) as Partial<PayloadConclusao>);
      const iniciativaIds = [...new Set(payloads.map((p) => p.iniciativaId).filter(Boolean) as string[])];
      const evidenciaIds = payloads.map((p) => p.evidenciaId).filter(Boolean) as string[];
      const [iniciativas, evidencias] = await Promise.all([
        prisma.iniciativa.findMany({
          where: { id: { in: iniciativaIds }, AND: [iniciativaScopeFilter(user)] },
          select: { id: true, codigo: true, nome: true, secretariaPrincipal: { select: { nome: true, sigla: true } } },
        }),
        prisma.evidencia.findMany({
          where: { id: { in: evidenciaIds } },
          select: { id: true, titulo: true, tipo: true, descricao: true, arquivoNome: true, urlOuArquivo: true, status: true },
        }),
      ]);
      const iniMap = new Map(iniciativas.map((i) => [i.id, i]));
      const evMap = new Map(evidencias.map((e) => [e.id, e]));
      const data = rows
        .map((r, idx) => {
          const p = payloads[idx];
          const iniciativa = p.iniciativaId ? iniMap.get(p.iniciativaId) : undefined;
          if (!iniciativa) return null;
          const ev = p.evidenciaId ? evMap.get(p.evidenciaId) : undefined;
          return {
            id: r.id,
            entidadeTipo: r.entidadeTipo,
            entidadeId: r.entidadeId,
            descricao: p.descricao ?? "",
            justificativa: r.justificativa,
            status: r.status,
            createdAt: r.createdAt.toISOString(),
            autor: r.autor,
            iniciativa,
            evidencia: ev
              ? { ...ev, urlOuArquivo: ev.tipo === "LINK" ? ev.urlOuArquivo : null }
              : null,
            decisao: r.decisoes[0]
              ? {
                  resultado: r.decisoes[0].resultado,
                  parecer: r.decisoes[0].parecer,
                  validador: r.decisoes[0].validador?.name ?? null,
                  createdAt: r.decisoes[0].createdAt.toISOString(),
                }
              : null,
          };
        })
        .filter(Boolean);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
);

const decidirSchema = z.object({
  resultado: z.enum(["APROVADA", "DEVOLVIDA"]),
  parecer: z.string().trim().min(3, "Registre o parecer da validação"),
});

execucaoRouter.post(
  "/solicitacoes/:id/decidir",
  requirePermission("tarefa:validar"),
  async (req, res, next) => {
    try {
      const body = decidirSchema.parse(req.body);
      const sol = await prisma.solicitacaoValidacao.findFirst({
        where: { id: req.params.id, municipioId: req.user!.municipioId, tipo: "CONCLUSAO" },
      });
      if (!sol) throw new HttpError(404, "NOT_FOUND", "Pedido não encontrado");
      if (sol.status !== "ABERTA") throw new HttpError(409, "JA_DECIDIDA", "Este pedido já foi decidido");
      const p = (sol.payload || {}) as Partial<PayloadConclusao>;
      const alvo = await carregarAlvo(sol.entidadeTipo as "MARCO" | "SUBTAREFA", sol.entidadeId);

      if (body.resultado === "APROVADA") {
        const ini = await prisma.iniciativa.findUniqueOrThrow({
          where: { id: alvo.iniciativa.id },
          select: { ciclo: true, bloqueioLabel: true },
        });
        if (!assertExecucaoPermitida(ini.ciclo)) {
          throw new HttpError(422, "BLOQUEADO_PRE_REQUISITO", ini.bloqueioLabel || "Projeto aguardando pré-requisito");
        }
      }

      await prisma.$transaction(async (tx) => {
        const changed = await tx.solicitacaoValidacao.updateMany({
          where: { id: sol.id, status: "ABERTA" },
          data: { status: "DECIDIDA" },
        });
        if (changed.count !== 1) throw new HttpError(409, "JA_DECIDIDA", "Este pedido já foi decidido");
        await tx.decisaoValidacao.create({
          data: { solicitacaoId: sol.id, resultado: body.resultado, parecer: body.parecer, validadorId: req.user!.id },
        });
        if (body.resultado === "APROVADA") {
          if (sol.entidadeTipo === "MARCO") {
            await tx.marcoEntrega.updateMany({ where: { id: sol.entidadeId, concluidoEm: null }, data: { concluidoEm: new Date() } });
            await tx.subtarefa.updateMany({ where: { marcoId: sol.entidadeId, concluida: false }, data: { concluida: true } });
          } else {
            await tx.subtarefa.update({ where: { id: sol.entidadeId }, data: { concluida: true } });
          }
        }
        if (p.evidenciaId) {
          const status = body.resultado === "APROVADA" ? "VERIFICADA" : "REJEITADA";
          await tx.evidencia.update({ where: { id: p.evidenciaId }, data: { status } });
          await tx.validacaoEvidencia.create({
            data: { evidenciaId: p.evidenciaId, validadorId: req.user!.id, status, parecer: body.parecer },
          });
        }
        if (sol.autorId) {
          await notificarUsuario(
            {
              municipioId: sol.municipioId,
              userId: sol.autorId,
              tipo: "VALIDACAO_DECIDIDA",
              titulo: body.resultado === "APROVADA" ? "Conclusão validada pelo consultor" : "Conclusão devolvida pelo consultor",
              texto: `${alvo.iniciativa.codigo} · ${alvo.descricao}. Parecer: ${body.parecer}`,
              link: `/iniciativas/${alvo.iniciativa.id}?aba=andamento`,
              entidadeTipo: sol.entidadeTipo,
              entidadeId: sol.entidadeId,
            },
            tx,
          );
        }
      });
      await writeAudit({
        user: req.user,
        action: body.resultado === "APROVADA" ? "VALIDAR_CONCLUSAO" : "DEVOLVER_CONCLUSAO",
        entity: sol.entidadeTipo === "MARCO" ? "MarcoEntrega" : "Subtarefa",
        entityId: sol.entidadeId,
        after: { solicitacaoId: sol.id, ...body },
        ip: req.ip,
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

export const notificacoesRouter = Router();
notificacoesRouter.use(requireAuth);

notificacoesRouter.get("/", async (req, res, next) => {
  try {
    const where = { userId: req.user!.id, municipioId: req.user!.municipioId };
    const [data, naoLidas] = await Promise.all([
      prisma.notificacao.findMany({ where, orderBy: { createdAt: "desc" }, take: 50 }),
      prisma.notificacao.count({ where: { ...where, lidaEm: null } }),
    ]);
    res.json({ data, naoLidas });
  } catch (err) {
    next(err);
  }
});

notificacoesRouter.post("/:id/lida", async (req, res, next) => {
  try {
    await prisma.notificacao.updateMany({
      where: { id: req.params.id, userId: req.user!.id, lidaEm: null },
      data: { lidaEm: new Date() },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

notificacoesRouter.post("/lidas", async (req, res, next) => {
  try {
    await prisma.notificacao.updateMany({
      where: { userId: req.user!.id, municipioId: req.user!.municipioId, lidaEm: null },
      data: { lidaEm: new Date() },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
