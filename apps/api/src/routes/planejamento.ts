import { Router } from "express";
import { z } from "zod";
import { prisma } from "@cip/db";
import { HttpError } from "../middleware/error";
import {
  iniciativaScopeFilter,
  requireAuth,
  requirePermission,
} from "../middleware/auth";
import { writeAudit } from "../services/audit";
import { progressoIndicador } from "../services/indicadores";
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
            indicadores: meta.indicadores.map((ind) => ({
              ...ind,
              progresso: progressoIndicador(ind),
              createdAt: ind.createdAt.toISOString(),
              updatedAt: ind.updatedAt.toISOString(),
            })),
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
  responsavelUserId: z.string().nullable().optional(),
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
      const responsavelUser = await resolverResponsavel(municipioId, body.responsavelUserId);
      const meta = await prisma.metaEstrategica.create({
        data: {
          responsavelUserId: responsavelUser?.id ?? null,
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
      await notificarAtribuicao({
        municipioId,
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
  metaEstrategicaId: z.string().nullable().optional(),
  metaExecucaoId: z.string().nullable().optional(),
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

async function assertAlvosIndicador(
  municipioId: string,
  body: { metaEstrategicaId?: string | null; metaExecucaoId?: string | null },
) {
  if (body.metaEstrategicaId) {
    const ok = await prisma.metaEstrategica.findFirst({
      where: { id: body.metaEstrategicaId, plano: { municipioId } },
      select: { id: true },
    });
    if (!ok) throw new HttpError(422, "INVALID_META", "Meta estratégica inválida");
  }
  if (body.metaExecucaoId) {
    const ok = await prisma.metaExecucao.findFirst({
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
      if (!body.metaEstrategicaId && !body.metaExecucaoId) {
        throw new HttpError(422, "TARGET_REQUIRED", "Vincule o indicador a uma meta estratégica ou de execução");
      }
      await assertAlvosIndicador(municipioId, body);
      const responsavelUser = await resolverResponsavel(municipioId, body.responsavelUserId);
      const row = await prisma.indicador.create({
        data: { ...body, municipioId, responsavelUserId: responsavelUser?.id ?? null },
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
      const existing = await prisma.indicador.findFirst({ where: { id: req.params.id, municipioId } });
      if (!existing) throw new HttpError(404, "NOT_FOUND", "Indicador não encontrado");
      const { responsavelUserId, ...body } = indicadorSchema.partial().parse(req.body);
      await assertAlvosIndicador(municipioId, body);
      const responsavelUser = await resolverResponsavel(municipioId, responsavelUserId);
      const row = await prisma.indicador.update({
        where: { id: existing.id },
        data: {
          ...body,
          ...(responsavelUser !== undefined ? { responsavelUserId: responsavelUser?.id ?? null } : {}),
        },
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

// ------------------------------------------------- Implantação da prefeitura

planejamentoRouter.get(
  "/implantacao",
  requirePermission("iniciativa:write"),
  async (req, res, next) => {
    try {
      const municipioId = req.user!.municipioId;
      const [municipio, secretarias, vinculos, planos, metas, indicadores, projetos, metasExec, tarefas, tarefasComResp] =
        await Promise.all([
          prisma.municipio.findUnique({
            where: { id: municipioId },
            select: { nome: true, uf: true, prefeitoNome: true, mandatoInicio: true, mandatoFim: true },
          }),
          prisma.secretaria.findMany({
            where: { municipioId, active: true },
            select: {
              id: true,
              nome: true,
              sigla: true,
              _count: { select: { metas: true, iniciativas: true } },
              usuariosVinculo: { where: { roleCode: "gestor" }, select: { user: { select: { name: true } } } },
            },
            orderBy: { nome: "asc" },
          }),
          prisma.vinculoUsuarioMunicipio.groupBy({ by: ["roleCode"], where: { municipioId }, _count: true }),
          prisma.planoGoverno.count({ where: { municipioId } }),
          prisma.metaEstrategica.findMany({
            where: { plano: { municipioId } },
            select: { id: true, _count: { select: { indicadores: { where: { ativo: true } }, iniciativas: true } } },
          }),
          prisma.indicador.count({ where: { municipioId, ativo: true } }),
          prisma.iniciativa.count({ where: { municipioId } }),
          prisma.metaExecucao.count({ where: { iniciativa: { municipioId } } }),
          prisma.marcoEntrega.count({ where: { iniciativa: { municipioId } } }),
          prisma.marcoEntrega.count({ where: { iniciativa: { municipioId }, responsavelUserId: { not: null } } }),
        ]);
      const porPapel = Object.fromEntries(vinculos.map((v) => [v.roleCode, v._count]));
      const secretariasSemSecretario = secretarias.filter((s) => s.usuariosVinculo.length === 0).length;
      const metasSemIndicador = metas.filter((m) => m._count.indicadores === 0).length;
      const metasSemProjeto = metas.filter((m) => m._count.iniciativas === 0).length;

      const etapas = [
        { id: "secretarias", titulo: "Cadastrar secretarias", feito: secretarias.length > 0, detalhe: `${secretarias.length} secretaria(s)`, href: "/secretarias" },
        { id: "equipe", titulo: "Vincular prefeito e secretários", feito: (porPapel.prefeito ?? 0) > 0 && secretarias.length > 0 && secretariasSemSecretario === 0, detalhe: `${porPapel.prefeito ?? 0} prefeito · ${porPapel.gestor ?? 0} secretário(s) · ${secretariasSemSecretario} secretaria(s) sem secretário`, href: "/equipe" },
        { id: "plano", titulo: "Registrar o plano de governo", feito: planos > 0, detalhe: `${planos} plano(s)`, href: "/planejamento" },
        { id: "metas", titulo: "Definir metas estratégicas por secretaria", feito: metas.length > 0, detalhe: `${metas.length} meta(s)`, href: "/planejamento" },
        { id: "indicadores", titulo: "Associar indicadores às metas", feito: metas.length > 0 && metasSemIndicador === 0, detalhe: `${indicadores} indicador(es) · ${metasSemIndicador} meta(s) sem indicador`, href: "/planejamento" },
        { id: "projetos", titulo: "Desdobrar metas em projetos", feito: projetos > 0 && metasSemProjeto === 0, detalhe: `${projetos} projeto(s) · ${metasSemProjeto} meta(s) sem projeto`, href: "/minha-pasta/novo" },
        { id: "metas-execucao", titulo: "Criar metas de execução nos projetos", feito: metasExec > 0, detalhe: `${metasExec} meta(s) de execução`, href: "/carteira" },
        { id: "tarefas", titulo: "Planejar tarefas com responsável e prazo", feito: tarefas > 0 && tarefasComResp === tarefas, detalhe: `${tarefas} tarefa(s) · ${tarefas - tarefasComResp} sem responsável`, href: "/acoes" },
      ];
      res.json({
        data: {
          municipio,
          etapas,
          concluidas: etapas.filter((e) => e.feito).length,
          total: etapas.length,
          secretarias: secretarias.map((s) => ({
            id: s.id,
            nome: s.nome,
            sigla: s.sigla,
            secretarios: s.usuariosVinculo.map((v) => v.user.name),
            metas: s._count.metas,
            projetos: s._count.iniciativas,
          })),
        },
      });
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
      await prisma.$transaction(async (tx) => {
        if (aceitar && prop?.tipo === "INDICADOR" && sug.entidadeId) {
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
