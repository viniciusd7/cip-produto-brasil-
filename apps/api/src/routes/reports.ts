import { Router } from "express";
import { z } from "zod";
import { prisma } from "@cip/db";
import {
  iniciativaScopeFilter,
  requireAuth,
  requirePermission,
} from "../middleware/auth";
import { prazoStatus } from "../services/prazo";
import {
  classificarSecretaria,
  derivarGravidade,
  GRAVIDADE_METODO_VERSAO,
  indicePonderado,
} from "../services/gravidade";
import { writeAudit } from "../services/audit";
import { consultaRelatorioSchema, consultarRelatorio, exportarConsultaCsv } from "../services/relatorio-consulta";

export const reportsRouter = Router();

reportsRouter.use(requireAuth, requirePermission("report:export"));

async function buildSecretariaReport(municipioId: string, user: NonNullable<import("express").Request["user"]>) {
  const iniciativas = await prisma.iniciativa.findMany({
    where: { municipioId, AND: [iniciativaScopeFilter(user)] },
    include: {
      secretariaPrincipal: true,
      marcos: { include: { reprogramacoes: true } },
      impedimentos: true,
    },
  });
  const secretarias = await prisma.secretaria.findMany({
    where: {
      municipioId,
      active: true,
      ...(user.role === "gestor"
        ? { id: user.secretariaId || "__no_secretaria__" }
        : {}),
    },
    orderBy: { nome: "asc" },
  });
  const dataRef =
    iniciativas.find((i) => i.dataReferencia)?.dataReferencia ?? new Date();
  const in15 = new Date(dataRef);
  in15.setDate(in15.getDate() + 15);

  return secretarias.map((s) => {
    const inis = iniciativas.filter((i) => i.secretariaPrincipalId === s.id);
    const tarefas = inis.flatMap((i) =>
      i.marcos.map((m) => {
        const st = prazoStatus(m, i.dataReferencia ?? dataRef);
        const grav =
          m.gravidade ||
          derivarGravidade({
            prazoStatus: st,
            prazoOriginal: m.prazoOriginal,
            prazoVigente: m.prazoVigente,
            reprogramacoes: m.reprogramacoes.length,
            dataReferencia: i.dataReferencia ?? dataRef,
          });
        return {
          id: m.id,
          codigo: m.codigo,
          descricao: m.descricao,
          status: st,
          gravidade: grav,
          prazoVigente: m.prazoVigente,
          iniciativaId: i.id,
          iniciativaCodigo: i.codigo,
          iniciativaNome: i.nome,
          responsavel: m.responsavel,
        };
      }),
    );
    const total = tarefas.length;
    const concluidas = tarefas.filter((t) => t.status === "CONCLUIDO").length;
    const atrasadas = tarefas.filter((t) => t.status === "VENCIDO");
    const semPrazo = tarefas.filter((t) => t.status === "SEM_PRAZO");
    const abertas = total - concluidas;
    const pctAtraso = abertas
      ? Math.round((atrasadas.length / abertas) * 1000) / 10
      : 0;
    const idx = indicePonderado(atrasadas, abertas || 1);
    const last = inis
      .map((i) => i.atualizadoEm)
      .sort((a, b) => b.getTime() - a.getTime())[0];
    const dias = last
      ? Math.floor((dataRef.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const projetos = inis.map((i) => {
      const ts = tarefas.filter((t) => t.iniciativaId === i.id);
      const atr = ts.filter((t) => t.status === "VENCIDO").length;
      return {
        id: i.id,
        codigo: i.codigo,
        nome: i.nome,
        totalTarefas: ts.length,
        atrasadas: atr,
        concluidas: ts.filter((t) => t.status === "CONCLUIDO").length,
        pctAtraso: ts.length
          ? Math.round(
              (atr / Math.max(1, ts.length - ts.filter((t) => t.status === "CONCLUIDO").length)) *
                1000,
            ) / 10
          : 0,
      };
    });

    return {
      id: s.id,
      nome: s.nome,
      sigla: s.sigla,
      classificacao: classificarSecretaria({
        diasSemAtualizacao: dias,
        pctAtrasoAbertas: pctAtraso,
        indicePonderado: idx,
        pctSemPrazoAbertas: abertas
          ? Math.round((semPrazo.length / abertas) * 1000) / 10
          : 0,
      }),
      kpis: {
        totalTarefas: total,
        abertas,
        concluidas,
        atrasadas: atrasadas.length,
        semPrazo: semPrazo.length,
        pctAtraso,
        indicePonderado: idx,
        diasSemAtualizacao: dias,
      },
      projetos,
      pedemAcao: {
        atrasadas: atrasadas.map((t) => ({
          id: t.id,
          descricao: t.descricao,
          projeto: t.iniciativaNome,
          gravidade: t.gravidade,
          responsavel: t.responsavel,
        })),
        vencemEm15d: tarefas
          .filter(
            (t) =>
              t.status === "NO_PRAZO" &&
              t.prazoVigente &&
              t.prazoVigente <= in15,
          )
          .map((t) => ({
            id: t.id,
            descricao: t.descricao,
            projeto: t.iniciativaNome,
            prazo: t.prazoVigente?.toISOString() ?? null,
          })),
        semPrazo: semPrazo.map((t) => ({
          id: t.id,
          descricao: t.descricao,
          projeto: t.iniciativaNome,
        })),
      },
    };
  });
}

reportsRouter.get("/executivo.json", async (req, res, next) => {
  try {
    const municipioId = req.user!.municipioId;
    const porSecretaria = await buildSecretariaReport(municipioId, req.user!);
    res.json({
      data: {
        geradoEm: new Date().toISOString(),
        metodoVersao: GRAVIDADE_METODO_VERSAO,
        observacao:
          "Indicadores de prazo e conclusão são dimensões separadas. Evidência declarada ≠ entrega comprovada. Atraso permanece após reprogramação.",
        porSecretaria,
      },
    });
  } catch (err) {
    next(err);
  }
});

reportsRouter.get("/executivo.csv", async (req, res, next) => {
  try {
    const municipioId = req.user!.municipioId;
    const porSecretaria = await buildSecretariaReport(municipioId, req.user!);
    const header = [
      "secretaria",
      "classificacao",
      "tarefas_total",
      "abertas",
      "atrasadas",
      "pct_atraso",
      "indice_ponderado",
      "sem_prazo",
      "dias_sem_atualizacao",
    ];
    const lines = [header.join(",")];
    for (const s of porSecretaria) {
      lines.push(
        [
          `"${s.nome}"`,
          s.classificacao,
          s.kpis.totalTarefas,
          s.kpis.abertas,
          s.kpis.atrasadas,
          s.kpis.pctAtraso,
          s.kpis.indicePonderado,
          s.kpis.semPrazo,
          s.kpis.diasSemAtualizacao ?? "",
        ].join(","),
      );
    }

    await writeAudit({
      user: req.user,
      action: "EXPORT_CSV",
      entity: "Relatorio",
      after: {
        tipo: "executivo.csv",
        metodoVersao: GRAVIDADE_METODO_VERSAO,
        linhas: porSecretaria.length,
      },
      ip: req.ip,
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="cip-relatorio-secretarias.csv"',
    );
    res.send(lines.join("\n"));
  } catch (err) {
    next(err);
  }
});

reportsRouter.get("/secretarias.json", async (req, res, next) => {
  try {
    const rows = await buildSecretariaReport(req.user!.municipioId, req.user!);
    res.json({
      data: rows,
      meta: { metodoVersao: GRAVIDADE_METODO_VERSAO },
    });
  } catch (err) {
    next(err);
  }
});

/* ── Prestação de contas com filtros (período, secretaria, projeto, situação) ── */

type PrestacaoFiltros = {
  de: Date | null;
  ate: Date | null;
  secretariaId: string | null;
  iniciativaId: string | null;
  status: string | null;
};

const diaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((valor) => {
  const data = new Date(`${valor}T00:00:00.000Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}, "Data inválida");
const filtrosSchema = z.object({
  de: diaSchema.optional(),
  ate: diaSchema.optional(),
  secretariaId: z.string().trim().min(1).optional(),
  projetoId: z.string().trim().min(1).optional(),
  status: z.enum(["CONCLUIDO", "NO_PRAZO", "SEM_PRAZO", "VENCIDO", "ENCERRADO_SEM_SOLUCAO"]).optional(),
}).refine((f) => !f.de || !f.ate || f.de <= f.ate, {
  path: ["ate"], message: "A data final deve ser igual ou posterior à inicial",
});

function lerFiltros(query: Record<string, unknown>): PrestacaoFiltros {
  const entrada = Object.fromEntries(Object.entries(query).filter(([, valor]) => valor !== ""));
  const f = filtrosSchema.parse(entrada);
  return {
    de: f.de ? new Date(`${f.de}T00:00:00.000Z`) : null,
    ate: f.ate ? new Date(`${f.ate}T23:59:59.999Z`) : null,
    secretariaId: f.secretariaId ?? null,
    iniciativaId: f.projetoId ?? null,
    status: f.status ?? null,
  };
}

function chaveMes(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function buildPrestacao(
  user: NonNullable<import("express").Request["user"]>,
  f: PrestacaoFiltros,
) {
  const municipioId = user.municipioId;
  const dentro = (d: Date | null | undefined) =>
    !!d && (!f.de || d >= f.de) && (!f.ate || d <= f.ate);
  const temPeriodo = !!(f.de || f.ate);

  const [secretariasMunicipio, iniciativas, plano] = await Promise.all([
    prisma.secretaria.findMany({
      where: {
        municipioId,
      },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, sigla: true, titularNome: true },
    }),
    prisma.iniciativa.findMany({
      where: { municipioId, AND: [iniciativaScopeFilter(user)] },
      orderBy: { codigo: "asc" },
      include: {
        marcos: {
          include: {
            subtarefas: {
              select: { id: true, descricao: true, concluida: true, prazo: true, responsavel: true },
              orderBy: { createdAt: "asc" },
            },
            evidencias: { select: { id: true, status: true } },
            _count: { select: { reprogramacoes: true } },
          },
        },
        evidencias: { select: { id: true, tipo: true, status: true, createdAt: true } },
      },
    }),
    prisma.planoGoverno.findFirst({
      where: { municipioId },
      orderBy: { createdAt: "desc" },
      select: { nome: true, mandatoInicio: true, mandatoFim: true },
    }),
  ]);

  const secretariasDosProjetos = new Set(iniciativas.map((i) => i.secretariaPrincipalId));
  const secretariasTodas = secretariasMunicipio.filter((s) =>
    user.role !== "gestor" || s.id === user.secretariaId || secretariasDosProjetos.has(s.id),
  );
  const secNome = new Map(secretariasTodas.map((s) => [s.id, s]));
  const nomeSecretaria = (id: string) => {
    const secretaria = secNome.get(id);
    if (!secretaria) return "Secretaria não informada";
    return secretaria.sigla && secretaria.sigla !== secretaria.nome
      ? `${secretaria.nome} (${secretaria.sigla})`
      : secretaria.nome;
  };
  const projetosOpcoes = iniciativas
    .map((i) => ({ id: i.id, codigo: i.codigo, nome: i.nome, secretariaId: i.secretariaPrincipalId }));

  const inisFiltradas = iniciativas.filter(
    (i) =>
      (!f.secretariaId || i.secretariaPrincipalId === f.secretariaId) &&
      (!f.iniciativaId || i.id === f.iniciativaId),
  );

  const agora = new Date();
  const todasTarefas = inisFiltradas.flatMap((i) =>
    i.marcos.map((m) => {
      const status = m.encerradoSemSolucaoEm ? "ENCERRADO_SEM_SOLUCAO" : prazoStatus(m, i.dataReferencia ?? agora);
      const noPrazoEntregue =
        !!m.concluidoEm && (!m.prazoVigente || m.concluidoEm.getTime() <= m.prazoVigente.getTime() + 86_399_999);
      return {
        id: m.id,
        codigo: m.codigo,
        descricao: m.descricao,
        status,
        prazo: m.prazoVigente,
        prazoOriginal: m.prazoOriginal,
        concluidoEm: m.concluidoEm,
        entregueNoPrazo: noPrazoEntregue,
        reprogramacoes: m._count.reprogramacoes,
        responsavel: m.responsavel,
        subtarefas: {
          total: m.subtarefas.length,
          feitas: m.subtarefas.filter((s) => s.concluida).length,
          itens: m.subtarefas.map((subtarefa) => ({
            id: subtarefa.id,
            descricao: subtarefa.descricao,
            concluida: subtarefa.concluida,
            prazo: subtarefa.prazo?.toISOString() ?? null,
            responsavel: subtarefa.responsavel,
          })),
        },
        evidencias: {
          total: m.evidencias.length,
          aprovadas: m.evidencias.filter((e) => e.status === "VERIFICADA").length,
        },
        projetoId: i.id,
        projetoCodigo: i.codigo,
        projetoNome: i.nome,
        secretariaId: i.secretariaPrincipalId,
      };
    }),
  );

  const noPeriodo = todasTarefas.filter(
    (t) => !temPeriodo || dentro(t.prazo) || dentro(t.concluidoEm),
  );
  const tarefas = noPeriodo.filter((t) => !f.status || t.status === f.status);

  const contar = (lista: typeof tarefas) => {
    const concluidas = lista.filter((t) => t.status === "CONCLUIDO").length;
    const atrasadas = lista.filter((t) => t.status === "VENCIDO").length;
    const semPrazo = lista.filter((t) => t.status === "SEM_PRAZO").length;
    const noPrazo = lista.filter((t) => t.status === "NO_PRAZO").length;
    const total = lista.length;
    return {
      total,
      concluidas,
      noPrazo,
      semPrazo,
      atrasadas,
      pctEmDia: total ? Math.round(((concluidas + noPrazo) / total) * 100) : null,
    };
  };

  const entregues = tarefas.filter((t) => t.concluidoEm && (!temPeriodo || dentro(t.concluidoEm)));
  const entreguesNoPrazo = entregues.filter((t) => t.entregueNoPrazo).length;

  // Evolução mensal: meses do período (ou últimos 6 meses + próximos 2), limitado a 12 colunas.
  const inicioEvo = new Date(f.de ?? agora);
  inicioEvo.setUTCDate(1);
  inicioEvo.setUTCHours(0, 0, 0, 0);
  if (!f.de) inicioEvo.setUTCMonth(inicioEvo.getUTCMonth() - 5);
  const fimEvo = new Date(f.ate ?? agora);
  fimEvo.setUTCDate(1);
  fimEvo.setUTCHours(0, 0, 0, 0);
  if (!f.ate) fimEvo.setUTCMonth(fimEvo.getUTCMonth() + 2);
  const meses: Array<{ chave: string; previstas: number; entregues: number; noPrazo: number; atrasadas: number }> = [];
  for (let d = new Date(inicioEvo); d <= fimEvo && meses.length < 12; d.setUTCMonth(d.getUTCMonth() + 1)) {
    meses.push({ chave: chaveMes(d), previstas: 0, entregues: 0, noPrazo: 0, atrasadas: 0 });
  }
  const porMes = new Map(meses.map((m) => [m.chave, m]));
  for (const t of tarefas) {
    if (t.prazo) {
      const m = porMes.get(chaveMes(t.prazo));
      if (m) {
        m.previstas += 1;
        if (t.status === "VENCIDO") m.atrasadas += 1;
      }
    }
    if (t.concluidoEm) {
      const m = porMes.get(chaveMes(t.concluidoEm));
      if (m) {
        m.entregues += 1;
        if (t.entregueNoPrazo) m.noPrazo += 1;
      }
    }
  }

  const porSecretaria = secretariasTodas
    .filter((s) => !f.secretariaId || s.id === f.secretariaId)
    .filter((s) => !f.iniciativaId || inisFiltradas.some((i) => i.secretariaPrincipalId === s.id))
    .map((s) => {
      const lista = tarefas.filter((t) => t.secretariaId === s.id);
      return {
        id: s.id,
        nome: s.nome,
        sigla: s.sigla,
        titular: s.titularNome,
        projetos: inisFiltradas.filter((i) =>
          i.secretariaPrincipalId === s.id &&
          (!f.status && !temPeriodo || lista.some((t) => t.projetoId === i.id)),
        ).length,
        ...contar(lista),
      };
    })
    .sort((a, b) => (a.pctEmDia ?? 101) - (b.pctEmDia ?? 101) || b.atrasadas - a.atrasadas);

  const projetos = inisFiltradas
    .map((i) => {
      const lista = tarefas.filter((t) => t.projetoId === i.id);
      return {
        id: i.id,
        codigo: i.codigo,
        nome: i.nome,
        secretariaId: i.secretariaPrincipalId,
        secretaria: nomeSecretaria(i.secretariaPrincipalId),
        ...contar(lista),
      };
    })
    .filter((p) => !f.status && !temPeriodo || p.total > 0)
    .sort((a, b) => b.atrasadas - a.atrasadas || (a.pctEmDia ?? 0) - (b.pctEmDia ?? 0));

  const evidencias = inisFiltradas
    .flatMap((i) => i.evidencias.map((e) => ({
      ...e,
      secretaria: nomeSecretaria(i.secretariaPrincipalId),
      projeto: `${i.codigo} · ${i.nome}`,
    })))
    .filter((e) => !temPeriodo || dentro(e.createdAt));
  const evPorTipo = (["FOTO", "VIDEO", "DOCUMENTO"] as const).map((tipo) => ({
    tipo,
    total: evidencias.filter((e) => (e.tipo || "DOCUMENTO").toUpperCase() === tipo).length,
  }));

  const metasEst = await prisma.metaEstrategica.findMany({
    where: {
      plano: { municipioId },
      iniciativas: {
        some: { id: { in: inisFiltradas.map((iniciativa) => iniciativa.id) } },
      },
    },
    orderBy: { nome: "asc" },
    include: {
      secretaria: { select: { id: true, nome: true, sigla: true } },
      medicoes: {
        where: temPeriodo ? { dataCorte: { ...(f.de ? { gte: f.de } : {}), ...(f.ate ? { lte: f.ate } : {}) } } : {},
        orderBy: { dataCorte: "desc" },
        take: 1,
      },
      iniciativas: {
        where: { id: { in: inisFiltradas.map((iniciativa) => iniciativa.id) } },
        select: { id: true, codigo: true, nome: true },
        orderBy: { codigo: "asc" },
      },
      indicadores: {
        where: { ativo: true },
        include: {
          medicoes: {
            where: temPeriodo ? { dataCorte: { ...(f.de ? { gte: f.de } : {}), ...(f.ate ? { lte: f.ate } : {}) } } : {},
            orderBy: { dataCorte: "desc" },
            take: 1,
            select: { dataCorte: true, valorRealizado: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return {
    geradoEm: new Date().toISOString(),
    metodoVersao: GRAVIDADE_METODO_VERSAO,
    filtros: {
      de: f.de?.toISOString() ?? null,
      ate: f.ate?.toISOString() ?? null,
      secretariaId: f.secretariaId,
      projetoId: f.iniciativaId,
      status: f.status,
    },
    opcoes: {
      secretarias: secretariasTodas.map((s) => ({ id: s.id, nome: s.nome, sigla: s.sigla })),
      projetos: projetosOpcoes,
      mandato: plano
        ? { inicio: plano.mandatoInicio?.toISOString() ?? null, fim: plano.mandatoFim?.toISOString() ?? null }
        : null,
    },
    resumo: {
      ...contar(tarefas),
      projetos: new Set(tarefas.map((t) => t.projetoId)).size,
      secretarias: new Set(tarefas.map((t) => t.secretariaId)).size,
      entregues: entregues.length,
      pontualidade: entregues.length ? Math.round((entreguesNoPrazo / entregues.length) * 100) : null,
      reprogramadas: tarefas.filter((t) => t.reprogramacoes > 0).length,
      evidencias: {
        total: evidencias.length,
        aprovadas: evidencias.filter((e) => e.status === "VERIFICADA").length,
        aguardando: evidencias.filter((e) => e.status === "A_VERIFICAR").length,
        porTipo: evPorTipo,
      },
    },
    evolucao: meses,
    porSecretaria,
    projetos,
    evidenciasDetalhadas: evidencias.map((e) => ({
      id: e.id, secretaria: e.secretaria, projeto: e.projeto,
      tipo: e.tipo || "DOCUMENTO", status: e.status, criadaEm: e.createdAt.toISOString(),
    })),
    metasEstrategicas: metasEst.map((m) => {
      const atual = m.medicoes[0];
      return {
        id: m.id,
        nome: m.nome,
        unidade: m.unidade,
        alvo: m.alvo,
        base: m.valorBase,
        secretariaId: m.secretaria?.id ?? null,
        secretaria: m.secretaria ? (m.secretaria.sigla && m.secretaria.sigla !== m.secretaria.nome ? `${m.secretaria.nome} (${m.secretaria.sigla})` : m.secretaria.nome) : null,
        realizado: atual?.valorRealizado ?? null,
        dataCorte: atual?.dataCorte?.toISOString() ?? null,
        projetos: m.iniciativas,
        indicadores: m.indicadores.map((indicador) => ({
          id: indicador.id,
          nome: indicador.nome,
          unidade: indicador.unidade,
          valorBase: indicador.valorBase,
          alvo: indicador.alvo,
          valorAtual: indicador.valorAtual,
          periodicidade: indicador.periodicidade,
          medicao: indicador.medicoes[0]
            ? {
                valorRealizado: indicador.medicoes[0].valorRealizado,
                dataCorte: indicador.medicoes[0].dataCorte.toISOString(),
              }
            : null,
        })),
      };
    }),
    tarefas: tarefas
      .sort((a, b) => {
        const ordem = ["VENCIDO", "SEM_PRAZO", "NO_PRAZO", "CONCLUIDO"];
        return (
          ordem.indexOf(a.status) - ordem.indexOf(b.status) ||
          (a.prazo?.getTime() ?? Infinity) - (b.prazo?.getTime() ?? Infinity)
        );
      })
      .map((t) => ({
        ...t,
        secretaria: nomeSecretaria(t.secretariaId),
        prazo: t.prazo?.toISOString() ?? null,
        prazoOriginal: t.prazoOriginal?.toISOString() ?? null,
        concluidoEm: t.concluidoEm?.toISOString() ?? null,
      })),
  };
}

reportsRouter.get("/prestacao.json", async (req, res, next) => {
  try {
    const consultaFiltros = consultaRelatorioSchema.parse(req.query);
    const data = await buildPrestacao(req.user!, lerFiltros(req.query as Record<string, unknown>));
    const consulta = consultarRelatorio(data, consultaFiltros);
    await writeAudit({
      user: req.user, action: "GERAR_RELATORIO", entity: "Relatorio",
      after: { tipo: consulta.tipo, filtros: data.filtros, busca: consulta.busca,
        ordenar: consulta.ordenar, direcao: consulta.direcao, linhas: consulta.total },
      ip: req.ip,
    });
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ data: { ...data, consulta, csv: exportarConsultaCsv(consulta) } });
  } catch (err) {
    next(err);
  }
});

reportsRouter.get("/prestacao.csv", async (req, res, next) => {
  try {
    const consultaFiltros = consultaRelatorioSchema.parse(req.query);
    const data = await buildPrestacao(req.user!, lerFiltros(req.query as Record<string, unknown>));
    const consulta = consultarRelatorio(data, consultaFiltros);

    await writeAudit({
      user: req.user,
      action: "EXPORT_CSV",
      entity: "Relatorio",
      after: { tipo: "prestacao.csv", filtros: data.filtros, consulta: {
        tipo: consulta.tipo, busca: consulta.busca, ordenar: consulta.ordenar, direcao: consulta.direcao,
      }, linhas: consulta.total },
      ip: req.ip,
    });

    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="cip-prestacao-de-contas.csv"');
    res.send(exportarConsultaCsv(consulta));
  } catch (err) {
    next(err);
  }
});
