import { Router } from "express";
import { z } from "zod";
import { Prisma, prisma } from "@cip/db";
import { HttpError } from "../middleware/error";
import {
  iniciativaScopeFilter,
  requireAuth,
  requirePermission,
} from "../middleware/auth";
import { writeAudit } from "../services/audit";
import { progressoIndicador } from "../services/indicadores";
import { transacaoEstrategica } from "../services/integridade-estrategica";
import { listarResponsaveis, notificarAtribuicao, resolverResponsavel } from "../services/responsaveis";
import { provedorAtivo, type SugestaoIndicador, type SugestaoTarefa } from "../services/sugestoes";

export const planejamentoRouter = Router();
planejamentoRouter.use(requireAuth);

planejamentoRouter.get(
  "/resumo",
  requirePermission("iniciativa:read"),
  async (req, res, next) => {
    try {
      const municipioId = req.user!.municipioId;
      const gestorSecretariaId =
        req.user!.role === "gestor"
          ? req.user!.secretariaId || "__no_secretaria__"
          : null;
      const planos = await prisma.planoGoverno.findMany({
        where: { municipioId },
        include: {
          metas: {
            include: {
              secretaria: true,
              responsavelUser: { select: { id: true, name: true } },
              indicadores: {
                where: { ativo: true },
                include: { responsavelUser: { select: { id: true, name: true } } },
                orderBy: { createdAt: "asc" },
              },
              _count: {
                select: {
                  iniciativas:
                    req.user!.role === "gestor"
                      ? { where: { AND: [iniciativaScopeFilter(req.user!)] } }
                      : true,
                },
              },
            },
            ...(req.user!.role === "gestor"
              ? {
                  where: {
                    OR: [
                      {
                        secretariaId:
                          req.user!.secretariaId || "__no_secretaria__",
                      },
                      { secretariaId: null },
                    ],
                  },
                }
              : {}),
            orderBy: { codigo: "asc" },
          },
        },
        orderBy: { updatedAt: "desc" },
      });

      const projetosPlano = await prisma.iniciativa.findMany({
        where: {
          municipioId,
          ...(gestorSecretariaId
            ? { secretariaPrincipalId: gestorSecretariaId }
            : {}),
          OR: [
            { metaEstrategicaId: { not: null } },
            { classificacaoPrincipal: "PLANO_GOVERNO" },
            { classificacoes: { some: { classificacao: "PLANO_GOVERNO" } } },
            { vinculoPlanoGoverno: true },
          ],
        },
        select: {
          id: true,
          codigo: true,
          nome: true,
          metaEstrategicaId: true,
          secretariaPrincipal: { select: { nome: true, sigla: true } },
          metaEstrategica: { select: { id: true, nome: true, codigo: true } },
        },
        orderBy: { nome: "asc" },
      });

      const formatoProjeto = (p: (typeof projetosPlano)[number]) => ({
        id: p.id,
        codigo: p.codigo,
        nome: p.nome,
        secretaria: p.secretariaPrincipal.sigla || p.secretariaPrincipal.nome,
      });
      const idsMetas = new Set(planos.flatMap((plano) => plano.metas.map((meta) => meta.id)));
      const porMeta = new Map<string, ReturnType<typeof formatoProjeto>[]>();
      const projetosSemMeta: ReturnType<typeof formatoProjeto>[] = [];
      const metasExternas = new Map<
        string,
        { id: string; nome: string; codigo: string | null; projetos: ReturnType<typeof formatoProjeto>[] }
      >();
      for (const projeto of projetosPlano) {
        const item = formatoProjeto(projeto);
        if (projeto.metaEstrategicaId && idsMetas.has(projeto.metaEstrategicaId)) {
          const lista = porMeta.get(projeto.metaEstrategicaId) ?? [];
          lista.push(item);
          porMeta.set(projeto.metaEstrategicaId, lista);
        } else if (projeto.metaEstrategica) {
          const grupo = metasExternas.get(projeto.metaEstrategica.id) ?? {
            id: projeto.metaEstrategica.id,
            nome: projeto.metaEstrategica.nome,
            codigo: projeto.metaEstrategica.codigo,
            projetos: [],
          };
          grupo.projetos.push(item);
          metasExternas.set(projeto.metaEstrategica.id, grupo);
        } else {
          projetosSemMeta.push(item);
        }
      }

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
            projetos: porMeta.get(meta.id) ?? [],
            indicadores: meta.indicadores.map((ind) => ({
              ...ind,
              progresso: progressoIndicador(ind),
              createdAt: ind.createdAt.toISOString(),
              updatedAt: ind.updatedAt.toISOString(),
            })),
          })),
        })),
        meta: {
          municipioId,
          fonte: "Base de planejamento CIP",
          projetosSemMeta,
          metasExternas: [...metasExternas.values()],
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

const planoSchema = z.object({
  nome: z.string().trim().min(3, "Informe um nome com pelo menos 3 caracteres"),
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
  nome: z.string().trim().min(3, "Informe um nome com pelo menos 3 caracteres"),
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
  responsavelUserId: z.string().nullable().optional(),
});

planejamentoRouter.post(
  "/metas",
  requirePermission("iniciativa:write"),
  async (req, res, next) => {
    try {
      const body = metaSchema.extend({ secretariaId: z.string().min(1) }).parse(req.body);
      const municipioId = req.user!.municipioId;
      const meta = await transacaoEstrategica(async (tx) => {
        const plano = await tx.planoGoverno.findFirst({ where: { id: body.planoId, municipioId } });
        if (!plano) throw new HttpError(422, "INVALID_PLANO", "Plano inválido para esta prefeitura");
        const secretaria = await tx.secretaria.findFirst({ where: { id: body.secretariaId, municipioId, active: true } });
        if (!secretaria || (req.user!.role === "gestor" && req.user!.secretariaId !== secretaria.id)) {
          throw new HttpError(422, "INVALID_SECRETARIA", "Secretaria inválida para este acesso");
        }
        const responsavel = await resolverResponsavel(municipioId, body.responsavelUserId);
        return tx.metaEstrategica.create({ data: {
          ...body,
          responsavelUserId: responsavel?.id ?? null,
          prazo: body.prazo ? new Date(body.prazo) : null,
        } });
      });
      await writeAudit({ user: req.user, action: "CREATE", entity: "MetaEstrategica", entityId: meta.id, after: meta, ip: req.ip });
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
      const responsavelUser = await resolverResponsavel(req.user!.municipioId, body.responsavelUserId);
      if (body.secretariaId) {
        const secretaria = await prisma.secretaria.findFirst({
          where: { id: body.secretariaId, municipioId: req.user!.municipioId, active: true },
        });
        if (!secretaria) throw new HttpError(422, "INVALID_SECRETARIA", "Secretaria inválida");
      }
      const meta = await prisma.metaEstrategica.update({
        where: { id: existing.id },
        data: {
          ...body,
          prazo: body.prazo === undefined ? undefined : body.prazo ? new Date(body.prazo) : null,
        },
      });
      await notificarAtribuicao({
        municipioId: req.user!.municipioId,
        anteriorUserId: existing.responsavelUserId,
        novo: responsavelUser,
        autorId: req.user!.id,
        entidadeTipo: "META_ESTRATEGICA",
        entidadeId: meta.id,
        rotulo: "uma meta estratégica",
        descricao: `${meta.codigo ? `${meta.codigo} · ` : ""}${meta.nome}`,
        link: "/minha-pasta",
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

planejamentoRouter.get(
  "/responsaveis",
  requirePermission("iniciativa:read"),
  async (req, res, next) => {
    try {
      res.json({ data: await listarResponsaveis(req.user!.municipioId) });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------- Indicadores

const indicadorSchema = z.object({
  metaEstrategicaId: z.string().min(1).nullable().optional(),
  metaExecucaoId: z.string().min(1).nullable().optional(),
  nome: z.string().trim().min(3),
  descricao: z.string().nullable().optional(),
  formula: z.string().nullable().optional(),
  unidade: z.string().nullable().optional(),
  valorBase: z.string().nullable().optional(),
  alvo: z.string().nullable().optional(),
  valorAtual: z.string().nullable().optional(),
  periodicidade: z.string().nullable().optional(),
  fonte: z.string().nullable().optional(),
  polaridade: z.enum(["MAIOR_MELHOR", "MENOR_MELHOR"]).optional(),
  responsavelUserId: z.string().nullable().optional(),
});

function rejeitarMetaExecucaoParaNovoIndicador(metaExecucaoId?: string | null) {
  if (metaExecucaoId) {
    throw new HttpError(
      410,
      "META_EXECUCAO_DESCONTINUADA",
      "Novos indicadores devem ser vinculados a uma meta estratégica",
    );
  }
}

async function assertAlvosIndicador(
  client: Pick<Prisma.TransactionClient, "metaEstrategica" | "metaExecucao" | "iniciativa">,
  municipioId: string,
  body: { metaEstrategicaId?: string | null; metaExecucaoId?: string | null },
) {
  if (!body.metaEstrategicaId) {
    throw new HttpError(422, "TARGET_REQUIRED", "Vincule o indicador a uma meta estratégica");
  }
  if (body.metaEstrategicaId) {
    const ok = await client.metaEstrategica.findFirst({
      where: { id: body.metaEstrategicaId, plano: { municipioId } },
      select: { id: true },
    });
    if (!ok) throw new HttpError(422, "INVALID_META", "Meta estratégica inválida");

  }
  if (body.metaExecucaoId) {
    const ok = await client.metaExecucao.findFirst({
      where: { id: body.metaExecucaoId, iniciativa: { municipioId } },
      select: { id: true },
    });
    if (!ok) throw new HttpError(422, "INVALID_META_EXEC", "Meta de execução inválida");
  }
}

planejamentoRouter.get(
  "/indicadores",
  requirePermission("iniciativa:read"),
  async (req, res, next) => {
    try {
      const user = req.user!;
      const q = req.query;
      const data = await prisma.indicador.findMany({
        where: {
          municipioId: user.municipioId,
          ativo: true,
          ...(typeof q.metaEstrategicaId === "string" ? { metaEstrategicaId: q.metaEstrategicaId } : {}),
          ...(typeof q.metaExecucaoId === "string" ? { metaExecucaoId: q.metaExecucaoId } : {}),
          ...(user.role === "gestor"
            ? {
                OR: [
                  { metaEstrategica: { secretariaId: user.secretariaId || "__none__" } },
                  { metaExecucao: { iniciativa: iniciativaScopeFilter(user) } },
                  { responsavelUserId: user.id },
                ],
              }
            : {}),
        },
        include: {
          responsavelUser: { select: { id: true, name: true } },
          metaEstrategica: { select: { id: true, codigo: true, nome: true } },
          metaExecucao: { select: { id: true, codigo: true, nome: true } },
          medicoes: { orderBy: { dataCorte: "desc" }, take: 6 },
        },
        orderBy: { createdAt: "asc" },
      });
      res.json({ data: data.map((ind) => ({ ...ind, progresso: progressoIndicador(ind) })) });
    } catch (err) {
      next(err);
    }
  },
);

planejamentoRouter.post(
  "/indicadores",
  requirePermission("iniciativa:write"),
  async (req, res, next) => {
    try {
      const body = indicadorSchema.parse(req.body);
      const municipioId = req.user!.municipioId;
      rejeitarMetaExecucaoParaNovoIndicador(body.metaExecucaoId);
      if (!body.metaEstrategicaId && !body.metaExecucaoId) {
        throw new HttpError(422, "TARGET_REQUIRED", "Vincule o indicador a uma meta estratégica");
      }
      const responsavelUser = await resolverResponsavel(municipioId, body.responsavelUserId);
      const row = await transacaoEstrategica(async (tx) => {
        await assertAlvosIndicador(tx, municipioId, body);
        return tx.indicador.create({
          data: { ...body, municipioId, responsavelUserId: responsavelUser?.id ?? null },
        });
      });
      await notificarAtribuicao({
        municipioId,
        novo: responsavelUser,
        autorId: req.user!.id,
        entidadeTipo: "INDICADOR",
        entidadeId: row.id,
        rotulo: "um indicador",
        descricao: `${row.nome}${row.alvo ? ` — alvo ${row.alvo}${row.unidade ? ` ${row.unidade}` : ""}` : ""}. Registre as medições na periodicidade combinada.`,
        link: "/minha-pasta",
      });
      await writeAudit({ user: req.user, action: "CREATE", entity: "Indicador", entityId: row.id, after: row, ip: req.ip });
      res.status(201).json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);

planejamentoRouter.patch(
  "/indicadores/:id",
  requirePermission("iniciativa:write"),
  async (req, res, next) => {
    try {
      const municipioId = req.user!.municipioId;
      const { responsavelUserId, ...body } = indicadorSchema.partial().parse(req.body);
      const responsavelUser = await resolverResponsavel(municipioId, responsavelUserId);
      const { existing, row } = await transacaoEstrategica(async (tx) => {
        const existing = await tx.indicador.findFirst({ where: { id: req.params.id, municipioId } });
        if (!existing) throw new HttpError(404, "NOT_FOUND", "Indicador não encontrado");
        if (
          body.metaExecucaoId &&
          body.metaExecucaoId !== existing.metaExecucaoId
        ) {
          rejeitarMetaExecucaoParaNovoIndicador(body.metaExecucaoId);
        }
        const alvos = {
          metaEstrategicaId: body.metaEstrategicaId === undefined ? existing.metaEstrategicaId : body.metaEstrategicaId,
          metaExecucaoId: body.metaExecucaoId === undefined ? existing.metaExecucaoId : body.metaExecucaoId,
        };
        const mudouAlvo = alvos.metaEstrategicaId !== existing.metaEstrategicaId ||
          alvos.metaExecucaoId !== existing.metaExecucaoId;
        if (mudouAlvo) await assertAlvosIndicador(tx, municipioId, alvos);
        const row = await tx.indicador.update({
          where: { id: existing.id },
          data: {
            ...body,
            ...(responsavelUser !== undefined ? { responsavelUserId: responsavelUser?.id ?? null } : {}),
          },
        });
        return { existing, row };
      });
      await notificarAtribuicao({
        municipioId,
        anteriorUserId: existing.responsavelUserId,
        novo: responsavelUser,
        autorId: req.user!.id,
        entidadeTipo: "INDICADOR",
        entidadeId: row.id,
        rotulo: "um indicador",
        descricao: row.nome,
        link: "/minha-pasta",
      });
      await writeAudit({ user: req.user, action: "UPDATE", entity: "Indicador", entityId: row.id, before: existing, after: row, ip: req.ip });
      res.json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);

planejamentoRouter.delete(
  "/indicadores/:id",
  requirePermission("iniciativa:write"),
  async (req, res, next) => {
    try {
      const existing = await prisma.indicador.findFirst({
        where: { id: req.params.id, municipioId: req.user!.municipioId },
      });
      if (!existing) throw new HttpError(404, "NOT_FOUND", "Indicador não encontrado");
      await prisma.indicador.update({ where: { id: existing.id }, data: { ativo: false } });
      await writeAudit({ user: req.user, action: "DELETE", entity: "Indicador", entityId: existing.id, before: existing, ip: req.ip });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

const medicaoIndicadorSchema = z.object({
  dataCorte: z.string().datetime(),
  valorRealizado: z.string().trim().min(1),
  valorEsperado: z.string().optional(),
  fonte: z.string().optional(),
  confiabilidade: z.enum(["BAIXA", "MEDIA", "ALTA"]).optional(),
  observacao: z.string().optional(),
});

planejamentoRouter.post(
  "/indicadores/:id/medicoes",
  requirePermission("iniciativa:write"),
  async (req, res, next) => {
    try {
      const municipioId = req.user!.municipioId;
      const ind = await prisma.indicador.findFirst({ where: { id: req.params.id, municipioId, ativo: true } });
      if (!ind) throw new HttpError(404, "NOT_FOUND", "Indicador não encontrado");
      const body = medicaoIndicadorSchema.parse(req.body);
      const medicao = await prisma.$transaction(async (tx) => {
        const m = await tx.medicao.create({
          data: {
            municipioId,
            indicadorId: ind.id,
            metaEstrategicaId: ind.metaEstrategicaId,
            metaExecucaoId: ind.metaExecucaoId,
            dataCorte: new Date(body.dataCorte),
            valorRealizado: body.valorRealizado,
            valorEsperado: body.valorEsperado ?? ind.alvo,
            fonte: body.fonte ?? ind.fonte,
            confiabilidade: body.confiabilidade ?? "MEDIA",
            observacao: body.observacao,
            autorId: req.user!.id,
          },
        });
        const ultima = await tx.medicao.findFirst({
          where: { indicadorId: ind.id },
          orderBy: [{ dataCorte: "desc" }, { createdAt: "desc" }],
        });
        await tx.indicador.update({ where: { id: ind.id }, data: { valorAtual: ultima?.valorRealizado ?? body.valorRealizado } });
        return m;
      });
      await writeAudit({ user: req.user, action: "CREATE", entity: "Medicao", entityId: medicao.id, after: medicao, ip: req.ip });
      res.status(201).json({ data: medicao });
    } catch (err) {
      next(err);
    }
  },
);

// ------------------------------------------- Sugestões (IA) para o consultor

type SugestaoPayload =
  | ({ tipo: "INDICADOR" } & SugestaoIndicador)
  | ({ tipo: "TAREFA" } & SugestaoTarefa);

function lerSugestao(texto: string): SugestaoPayload | null {
  try {
    return JSON.parse(texto) as SugestaoPayload;
  } catch {
    return null;
  }
}

planejamentoRouter.get(
  "/sugestoes",
  requirePermission("iniciativa:write"),
  async (req, res, next) => {
    try {
      const entidadeId = typeof req.query.entidadeId === "string" ? req.query.entidadeId : undefined;
      const rows = await prisma.sugestaoIA.findMany({
        where: {
          municipioId: req.user!.municipioId,
          status: "PENDENTE",
          campo: { in: ["INDICADOR", "TAREFA"] },
          ...(entidadeId ? { entidadeId } : {}),
        },
        orderBy: { createdAt: "asc" },
      });
      res.json({ data: rows.map((r) => ({ ...r, proposta: lerSugestao(r.sugestao) })) });
    } catch (err) {
      next(err);
    }
  },
);

planejamentoRouter.post(
  "/metas/:id/sugestoes",
  requirePermission("iniciativa:write"),
  async (req, res, next) => {
    try {
      const municipioId = req.user!.municipioId;
      const meta = await prisma.metaEstrategica.findFirst({
        where: { id: req.params.id, plano: { municipioId } },
        include: { secretaria: { select: { nome: true } }, indicadores: { where: { ativo: true }, select: { nome: true } } },
      });
      if (!meta) throw new HttpError(404, "NOT_FOUND", "Meta estratégica não encontrada");
      const existentes = new Set(meta.indicadores.map((i) => i.nome.toLowerCase()));
      const pendentes = await prisma.sugestaoIA.findMany({
        where: { municipioId, entidadeId: meta.id, campo: "INDICADOR", status: "PENDENTE" },
        select: { sugestao: true },
      });
      for (const p of pendentes) {
        const prop = lerSugestao(p.sugestao);
        if (prop && "nome" in prop) existentes.add(prop.nome.toLowerCase());
      }
      const propostas = (await provedorAtivo.indicadores({ nome: meta.nome, descricao: meta.descricao, secretaria: meta.secretaria?.nome }))
        .filter((p) => !existentes.has(p.nome.toLowerCase()));
      await prisma.sugestaoIA.createMany({
        data: propostas.map((p) => ({
          municipioId,
          entidadeTipo: "META_ESTRATEGICA",
          entidadeId: meta.id,
          campo: "INDICADOR",
          sugestao: JSON.stringify({ tipo: "INDICADOR", ...p }),
          fonte: provedorAtivo.fonte,
          confianca: "MEDIA",
          autorId: req.user!.id,
        })),
      });
      res.status(201).json({ data: { criadas: propostas.length } });
    } catch (err) {
      next(err);
    }
  },
);

planejamentoRouter.post(
  "/metas-execucao/:id/sugestoes",
  requirePermission("iniciativa:write"),
  async (req, res, next) => {
    try {
      const municipioId = req.user!.municipioId;
      const meta = await prisma.metaExecucao.findFirst({
        where: { id: req.params.id, iniciativa: { municipioId } },
        include: { iniciativa: { select: { secretariaPrincipal: { select: { nome: true } } } }, marcos: { select: { descricao: true } } },
      });
      if (!meta) throw new HttpError(404, "NOT_FOUND", "Meta de execução não encontrada");
      const existentes = new Set(meta.marcos.map((m) => m.descricao.toLowerCase()));
      const jaSugeridas = await prisma.sugestaoIA.count({
        where: { municipioId, entidadeId: meta.id, campo: "TAREFA", status: "PENDENTE" },
      });
      if (jaSugeridas > 0) {
        res.status(201).json({ data: { criadas: 0 } });
        return;
      }
      const propostas = (await provedorAtivo.tarefas({ nome: meta.nome, secretaria: meta.iniciativa.secretariaPrincipal?.nome }))
        .filter((p) => !existentes.has(p.descricao.toLowerCase()));
      await prisma.sugestaoIA.createMany({
        data: propostas.map((p) => ({
          municipioId,
          entidadeTipo: "META_EXECUCAO",
          entidadeId: meta.id,
          campo: "TAREFA",
          sugestao: JSON.stringify({ tipo: "TAREFA", ...p }),
          fonte: provedorAtivo.fonte,
          confianca: "MEDIA",
          autorId: req.user!.id,
        })),
      });
      res.status(201).json({ data: { criadas: propostas.length } });
    } catch (err) {
      next(err);
    }
  },
);

planejamentoRouter.post(
  "/sugestoes/:id/decidir",
  requirePermission("iniciativa:write"),
  async (req, res, next) => {
    try {
      const { aceitar } = z.object({ aceitar: z.boolean() }).parse(req.body);
      const municipioId = req.user!.municipioId;
      const sug = await prisma.sugestaoIA.findFirst({ where: { id: req.params.id, municipioId, status: "PENDENTE" } });
      if (!sug) throw new HttpError(404, "NOT_FOUND", "Sugestão não encontrada ou já decidida");
      const prop = lerSugestao(sug.sugestao);
      let criado: { tipo: string; id: string } | null = null;
      await transacaoEstrategica(async (tx) => {
        if (aceitar && prop?.tipo === "INDICADOR" && sug.entidadeId) {
          await assertAlvosIndicador(tx, municipioId, { metaEstrategicaId: sug.entidadeId });
          const ind = await tx.indicador.create({
            data: {
              municipioId,
              metaEstrategicaId: sug.entidadeId,
              nome: prop.nome,
              unidade: prop.unidade,
              periodicidade: prop.periodicidade,
              polaridade: prop.polaridade,
              fonte: prop.fonte,
              formula: prop.formula,
            },
          });
          criado = { tipo: "INDICADOR", id: ind.id };
        } else if (aceitar && prop?.tipo === "TAREFA" && sug.entidadeId) {
          const meta = await tx.metaExecucao.findUniqueOrThrow({ where: { id: sug.entidadeId } });
          const ordem = (await tx.marcoEntrega.count({ where: { iniciativaId: meta.iniciativaId } })) + 1;
          const prazo = new Date(Date.now() + prop.diasPrazo * 86400000);
          const marco = await tx.marcoEntrega.create({
            data: {
              iniciativaId: meta.iniciativaId,
              metaExecucaoId: meta.id,
              descricao: prop.descricao,
              ordem,
              prazoOriginal: prazo,
              prazoVigente: prazo,
            },
          });
          criado = { tipo: "TAREFA", id: marco.id };
        }
        await tx.sugestaoIA.update({
          where: { id: sug.id },
          data: { status: aceitar ? "ACEITA" : "REJEITADA", decidedById: req.user!.id, decidedAt: new Date() },
        });
      });
      await writeAudit({
        user: req.user,
        action: aceitar ? "ACEITAR_SUGESTAO" : "REJEITAR_SUGESTAO",
        entity: "SugestaoIA",
        entityId: sug.id,
        after: { criado },
        ip: req.ip,
      });
      res.json({ data: { criado } });
    } catch (err) {
      next(err);
    }
  },
);
