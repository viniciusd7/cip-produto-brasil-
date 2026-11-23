import { createHash } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma, type Prisma } from "@cip/db";
import { assertIniciativaAccess, requireAuth, requirePermission } from "../middleware/auth";
import { HttpError } from "../middleware/error";
import { writeAudit } from "../services/audit";
import {
  antesDoCursor, comunicadoInclude, comunicadoScope, decodeCursor, destinatariosWhere,
  encodeCursor, mensagemRecebida, notificacaoScope, paginaComunicacaoSchema,
  projetoScope, recebidosScope,
} from "../services/comunicacao";

export const comunicadosRouter = Router();
comunicadosRouter.use(requireAuth, requirePermission("iniciativa:read"));

comunicadosRouter.get("/destinatarios", requirePermission("conversa:responder"), async (req, res, next) => {
  try {
    const iniciativaId = z.string().min(1).parse(req.query.iniciativaId);
    const projeto = await assertIniciativaAccess(req.user!, iniciativaId);
    const users = await prisma.user.findMany({
      where: destinatariosWhere(req.user!, projeto),
      select: { id: true, name: true, vinculos: { where: { municipioId: req.user!.municipioId }, select: { roleCode: true } } },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
    const labels: Record<string, string> = { gestor: "Secretário", funcionario: "Funcionário da secretaria", analista: "Consultor", admin: "Administração", prefeito: "Gabinete do Prefeito (consulta)" };
    res.json({ data: users.map((user) => ({ id: user.id, name: user.name, roles: user.vinculos.map((v) => ({ role: { name: labels[v.roleCode] || "Acesso" } })) })) });
  } catch (err) { next(err); }
});

comunicadosRouter.get("/projetos", async (req, res, next) => {
  try {
    const query = paginaComunicacaoSchema.extend({ q: z.string().trim().max(150).optional() }).parse(req.query);
    const cursor = decodeCursor(query.cursor);
    if (cursor && cursor.origem !== "projeto") throw new HttpError(400, "INVALID_CURSOR", "Página de projetos inválida");
    const rows = await prisma.iniciativa.findMany({
      where: { AND: [projetoScope(req.user!), antesDoCursor(cursor, "projeto"), ...(query.q ? [{ OR: [{ nome: { contains: query.q, mode: "insensitive" as const } }, { codigo: { contains: query.q, mode: "insensitive" as const } }] }] : [])] },
      select: {
        id: true, nome: true, codigo: true, createdAt: true,
        secretariaPrincipal: { select: { nome: true } },
        comunicados: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1, select: { texto: true, createdAt: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: query.limite + 1,
    });
    const data = rows.slice(0, query.limite);
    const last = data.at(-1);
    res.json({ data, nextCursor: rows.length > query.limite && last ? encodeCursor({ id: last.id, createdAt: last.createdAt, origem: "projeto" }) : null });
  } catch (err) { next(err); }
});

/** Duas origens persistidas, uma entrega visual por origem. Mensagens não geram
 * uma segunda Notificacao: o próprio Comunicado é o aviso do destinatário. */
comunicadosRouter.get("/avisos", async (req, res, next) => {
  try {
    const query = paginaComunicacaoSchema.parse(req.query);
    const cursor = decodeCursor(query.cursor);
    if (cursor?.origem === "projeto") throw new HttpError(400, "INVALID_CURSOR", "Página de avisos inválida");
    const user = req.user!;
    const notificacoes = await notificacaoScope(user);
    const comunicadoWhere: Prisma.ComunicadoWhereInput = { AND: [recebidosScope(user), ...(query.naoLidos === "1" ? [{ leituras: { none: { userId: user.id } } }] : [])] };
    const notificacaoWhere: Prisma.NotificacaoWhereInput = { AND: [notificacoes, ...(query.naoLidos === "1" ? [{ lidaEm: null }] : [])] };
    const [mensagens, eventos, mensagensNaoLidas, eventosNaoLidos] = await Promise.all([
      prisma.comunicado.findMany({ where: { AND: [comunicadoWhere, antesDoCursor(cursor, "comunicado")] }, include: comunicadoInclude(user.id), orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: query.limite + 1 }),
      prisma.notificacao.findMany({ where: { AND: [notificacaoWhere, antesDoCursor(cursor, "notificacao")] }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: query.limite + 1 }),
      prisma.comunicado.count({ where: { AND: [recebidosScope(user), { leituras: { none: { userId: user.id } } }] } }),
      prisma.notificacao.count({ where: { AND: [notificacoes, { lidaEm: null }] } }),
    ]);
    const merged = [
      ...mensagens.map((m) => ({ id: m.id, origem: "comunicado" as const, tipo: m.tipo, titulo: `${m.autor?.name || "Sistema CIP"} · ${m.iniciativa.nome}`, texto: m.texto, createdAt: m.createdAt, lidaEm: m.leituras[0]?.lidoEm ?? null, link: `/comunicados?projeto=${encodeURIComponent(m.iniciativaId)}` })),
      ...eventos.map((n) => ({ ...n, origem: "notificacao" as const })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (`${a.origem}:${a.id}` < `${b.origem}:${b.id}` ? 1 : -1));
    const data = merged.slice(0, query.limite);
    const last = data.at(-1);
    res.json({ data, naoLidas: mensagensNaoLidas + eventosNaoLidos, nextCursor: merged.length > query.limite && last ? encodeCursor({ id: last.id, createdAt: last.createdAt, origem: last.origem }) : null });
  } catch (err) { next(err); }
});

comunicadosRouter.get("/resumo", async (req, res, next) => {
  try {
    const user = req.user!;
    const scope = await notificacaoScope(user);
    const [mensagens, eventos] = await Promise.all([
      prisma.comunicado.count({ where: { AND: [recebidosScope(user), { leituras: { none: { userId: user.id } } }] } }),
      prisma.notificacao.count({ where: { AND: [scope, { lidaEm: null }] } }),
    ]);
    res.json({ naoLidas: mensagens + eventos });
  } catch (err) { next(err); }
});

comunicadosRouter.get("/", async (req, res, next) => {
  try {
    const query = paginaComunicacaoSchema.extend({ iniciativaId: z.string().min(1).optional() }).parse(req.query);
    const cursor = decodeCursor(query.cursor);
    if (cursor && cursor.origem !== "comunicado") throw new HttpError(400, "INVALID_CURSOR", "Página de mensagens inválida");
    const user = req.user!;
    if (query.iniciativaId) await assertIniciativaAccess(user, query.iniciativaId);
    const projeto = query.iniciativaId ? await prisma.iniciativa.findFirst({
      where: { AND: [projetoScope(user), { id: query.iniciativaId }] },
      select: { id: true, nome: true, codigo: true },
    }) : null;
    const rows = await prisma.comunicado.findMany({
      where: { AND: [
        query.iniciativaId ? { ...comunicadoScope(user), iniciativaId: query.iniciativaId } : recebidosScope(user),
        ...(query.naoLidos === "1" ? [{ leituras: { none: { userId: user.id } } }] : []),
        antesDoCursor(cursor, "comunicado"),
      ] },
      include: comunicadoInclude(user.id), orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: query.limite + 1,
    });
    const data = rows.slice(0, query.limite);
    const last = data.at(-1);
    const naoLidos = await prisma.comunicado.count({ where: { AND: [recebidosScope(user), { leituras: { none: { userId: user.id } } }] } });
    res.json({ data: data.map((item) => ({ ...item, recebida: mensagemRecebida(item, user) })), projeto, naoLidos, canRespond: user.permissions.includes("conversa:responder"), nextCursor: rows.length > query.limite && last ? encodeCursor({ id: last.id, createdAt: last.createdAt, origem: "comunicado" }) : null });
  } catch (err) { next(err); }
});

comunicadosRouter.post("/", requirePermission("conversa:responder"), async (req, res, next) => {
  try {
    const body = z.object({ iniciativaId: z.string().min(1), destinatarioId: z.string().min(1), texto: z.string().trim().min(3).max(5000), envioId: z.string().uuid().optional() }).parse(req.body);
    const user = req.user!;
    const projeto = await assertIniciativaAccess(user, body.iniciativaId);
    const destino = await prisma.user.findFirst({ where: { AND: [destinatariosWhere(user, projeto), { id: body.destinatarioId }] }, select: { id: true } });
    if (!destino) throw new HttpError(422, "INVALID_DESTINO", "Selecione uma pessoa ativa com acesso a este projeto");
    const id = body.envioId ? `msg_${createHash("sha256").update(`${user.id}:${body.envioId}`).digest("hex")}` : undefined;
    const existente = async () => {
      const row = id ? await prisma.comunicado.findUnique({ where: { id } }) : null;
      if (row && (row.autorId !== user.id || row.iniciativaId !== body.iniciativaId || row.destinatarioId !== body.destinatarioId || row.texto !== body.texto)) throw new HttpError(409, "ENVIO_CONFLICT", "Este envio já foi utilizado para outra mensagem");
      return row;
    };
    const anterior = await existente();
    if (anterior) { res.json({ data: anterior }); return; }
    try {
      const data = await prisma.$transaction(async (db) => {
        const row = await db.comunicado.create({ data: { id, iniciativaId: body.iniciativaId, autorId: user.id, destinatarioId: destino.id, texto: body.texto, tipo: "MENSAGEM" } });
        await writeAudit({ user, action: "SEND_MESSAGE", entity: "Comunicado", entityId: row.id, after: { iniciativaId: body.iniciativaId, destinatarioId: destino.id }, ip: req.ip }, db);
        return row;
      });
      res.location(`/comunicados?projeto=${encodeURIComponent(body.iniciativaId)}`).status(201).json({ data });
    } catch (error) {
      if (id && (error as { code?: string }).code === "P2002") {
        const row = await existente();
        if (row) { res.json({ data: row }); return; }
      }
      throw error;
    }
  } catch (err) { next(err); }
});

comunicadosRouter.post("/:id/lido", async (req, res, next) => {
  try {
    const user = req.user!;
    const item = await prisma.comunicado.findFirst({ where: { AND: [{ id: req.params.id }, recebidosScope(user)] } });
    if (!item) throw new HttpError(404, "NOT_FOUND", "Aviso não encontrado para este destinatário");
    await prisma.comunicadoLeitura.createMany({ data: [{ comunicadoId: item.id, userId: user.id }], skipDuplicates: true });
    res.json({ ok: true });
  } catch (err) { next(err); }
});
