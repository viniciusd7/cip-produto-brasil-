import { Router } from "express";
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

const STATUS_VALIDOS = ["CONCLUIDO", "NO_PRAZO", "SEM_PRAZO", "VENCIDO"];

function parseDia(valor: unknown, fimDoDia = false): Date | null {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const d = new Date(`${valor}T${fimDoDia ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function lerFiltros(query: Record<string, unknown>): PrestacaoFiltros {
  const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const status = texto(query.status);
  let de = parseDia(query.de);
  let ate = parseDia(query.ate, true);
  if (de && ate && de > ate) [de, ate] = [parseDia(query.ate), parseDia(query.de, true)];
  return {
    de,
    ate,
    secretariaId: texto(query.secretariaId),
    iniciativaId: texto(query.projetoId),
    status: status && STATUS_VALIDOS.includes(status) ? status : null,
  };
}

function chaveMes(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function numeroBr(valor: string | null | undefined) {
  if (valor == null) return null;
  const n = Number(String(valor).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

async function buildPrestacao(
  user: NonNullable<import("express").Request["user"]>,
  f: PrestacaoFiltros,
) {
  const municipioId = user.municipioId;
  const dentro = (d: Date | null | undefined) =>
    !!d && (!f.de || d >= f.de) && (!f.ate || d <= f.ate);
  const temPeriodo = !!(f.de || f.ate);

  const [secretariasTodas, iniciativas, plano] = await Promise.all([
    prisma.secretaria.findMany({
      where: {
        municipioId,
        active: true,
        ...(user.role === "gestor" ? { id: user.secretariaId || "__no_secretaria__" } : {}),
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
            metaExecucao: { select: { id: true, nome: true } },
            subtarefas: { select: { concluida: true } },
            evidencias: { select: { id: true, status: true } },
            _count: { select: { reprogramacoes: true } },
          },
        },
        metasExecucao: true,
        evidencias: { select: { id: true, tipo: true, status: true, createdAt: true } },
      },
    }),
    prisma.planoGoverno.findFirst({
      where: { municipioId },
      orderBy: { createdAt: "desc" },
      select: { nome: true, mandatoInicio: true, mandatoFim: true },
    }),
  ]);

  const secretariaIds = new Set(secretariasTodas.map((s) => s.id));
  const secNome = new Map(secretariasTodas.map((s) => [s.id, s]));
  const projetosOpcoes = iniciativas
    .filter((i) => secretariaIds.has(i.secretariaPrincipalId))
    .map((i) => ({ id: i.id, codigo: i.codigo, nome: i.nome, secretariaId: i.secretariaPrincipalId }));

  const inisFiltradas = iniciativas.filter(
    (i) =>
      secretariaIds.has(i.secretariaPrincipalId) &&
      (!f.secretariaId || i.secretariaPrincipalId === f.secretariaId) &&
      (!f.iniciativaId || i.id === f.iniciativaId),
  );

  const agora = new Date();
  const todasTarefas = inisFiltradas.flatMap((i) =>
    i.marcos.map((m) => {
      const status = prazoStatus(m, i.dataReferencia ?? agora);
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
        meta: m.metaExecucao?.nome ?? null,
        subtarefas: { total: m.subtarefas.length, feitas: m.subtarefas.filter((s) => s.concluida).length },
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
  const inicioEvo = f.de ? new Date(f.de.getFullYear(), f.de.getMonth(), 1) : new Date(agora.getFullYear(), agora.getMonth() - 5, 1);
  const fimEvo = f.ate ? new Date(f.ate.getFullYear(), f.ate.getMonth(), 1) : new Date(agora.getFullYear(), agora.getMonth() + 2, 1);
  const meses: Array<{ chave: string; previstas: number; entregues: number; noPrazo: number; atrasadas: number }> = [];
  for (let d = new Date(inicioEvo); d <= fimEvo && meses.length < 12; d.setMonth(d.getMonth() + 1)) {
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
    .map((s) => {
      const lista = tarefas.filter((t) => t.secretariaId === s.id);
      return {
        id: s.id,
        nome: s.nome,
        sigla: s.sigla,
        titular: s.titularNome,
        projetos: new Set(lista.map((t) => t.projetoId)).size,
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
        secretaria: secNome.get(i.secretariaPrincipalId)?.sigla || secNome.get(i.secretariaPrincipalId)?.nome || "",
        ...contar(lista),
      };
    })
    .filter((p) => p.total > 0)
    .sort((a, b) => b.atrasadas - a.atrasadas || (a.pctEmDia ?? 0) - (b.pctEmDia ?? 0));

  const metasExecucao = inisFiltradas.flatMap((i) =>
    i.metasExecucao
      .filter((m) => !temPeriodo || !m.prazo || dentro(m.prazo))
      .map((m) => {
        const concluida = m.status === "CONCLUIDA" || m.status === "CONCLUIDO";
        const situacao = concluida
          ? "CONCLUIDA"
          : !m.prazo
            ? "SEM_PRAZO"
            : m.prazo < agora
              ? "VENCIDA"
              : "EM_ANDAMENTO";
        return { id: m.id, nome: m.nome, projeto: i.nome, prazo: m.prazo, situacao };
      }),
  );

  const evidencias = inisFiltradas
    .flatMap((i) => i.evidencias)
    .filter((e) => !temPeriodo || dentro(e.createdAt));
  const evPorTipo = (["FOTO", "VIDEO", "DOCUMENTO"] as const).map((tipo) => ({
    tipo,
    total: evidencias.filter((e) => (e.tipo || "DOCUMENTO").toUpperCase() === tipo).length,
  }));

  const metasEst = await prisma.metaEstrategica.findMany({
    where: {
      plano: { municipioId },
      ...(f.secretariaId
        ? { secretariaId: f.secretariaId }
        : user.role === "gestor"
          ? { secretariaId: user.secretariaId || "__no_secretaria__" }
          : {}),
    },
    orderBy: { nome: "asc" },
    include: {
      secretaria: { select: { nome: true, sigla: true } },
      medicoes: {
        where: f.ate ? { dataCorte: { lte: f.ate } } : {},
        orderBy: { dataCorte: "desc" },
        take: 1,
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
    metasExecucao: {
      total: metasExecucao.length,
      concluidas: metasExecucao.filter((m) => m.situacao === "CONCLUIDA").length,
      emAndamento: metasExecucao.filter((m) => m.situacao === "EM_ANDAMENTO").length,
      semPrazo: metasExecucao.filter((m) => m.situacao === "SEM_PRAZO").length,
      vencidas: metasExecucao.filter((m) => m.situacao === "VENCIDA").length,
    },
    metasEstrategicas: metasEst.map((m) => {
      const atual = m.medicoes[0];
      const realizado = numeroBr(atual?.valorRealizado);
      const alvo = numeroBr(m.alvo);
      const base = numeroBr(m.valorBase);
      let pct: number | null = null;
      if (realizado != null && alvo != null) {
        pct = base != null && alvo !== base
          ? Math.round(((realizado - base) / (alvo - base)) * 100)
          : alvo
            ? Math.round((realizado / alvo) * 100)
            : null;
        if (pct != null) pct = Math.max(0, Math.min(100, pct));
      }
      return {
        id: m.id,
        nome: m.nome,
        indicador: m.indicador,
        unidade: m.unidade,
        alvo: m.alvo,
        base: m.valorBase,
        secretaria: m.secretaria?.sigla || m.secretaria?.nome || null,
        realizado: atual?.valorRealizado ?? null,
        dataCorte: atual?.dataCorte?.toISOString() ?? null,
        pct,
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
      .slice(0, 500)
      .map((t) => ({
        ...t,
        secretaria: secNome.get(t.secretariaId)?.sigla || secNome.get(t.secretariaId)?.nome || "",
        prazo: t.prazo?.toISOString() ?? null,
        prazoOriginal: t.prazoOriginal?.toISOString() ?? null,
        concluidoEm: t.concluidoEm?.toISOString() ?? null,
      })),
  };
}

reportsRouter.get("/prestacao.json", async (req, res, next) => {
  try {
    const data = await buildPrestacao(req.user!, lerFiltros(req.query as Record<string, unknown>));
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

const STATUS_ROTULO: Record<string, string> = {
  CONCLUIDO: "Concluída",
  NO_PRAZO: "No prazo",
  SEM_PRAZO: "Sem prazo",
  VENCIDO: "Atrasada",
};

function csvCampo(v: unknown) {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function dataBr(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("pt-BR") : "";
}

reportsRouter.get("/prestacao.csv", async (req, res, next) => {
  try {
    const data = await buildPrestacao(req.user!, lerFiltros(req.query as Record<string, unknown>));
    const header = [
      "Secretaria",
      "Projeto",
      "Meta",
      "Tarefa",
      "Responsável",
      "Situação",
      "Prazo",
      "Prazo original",
      "Concluída em",
      "Reprogramações",
      "Subtarefas feitas",
      "Evidências",
      "Evidências aprovadas",
    ];
    const linhas = [header.join(";")];
    for (const t of data.tarefas) {
      linhas.push(
        [
          t.secretaria,
          `${t.projetoCodigo} · ${t.projetoNome}`,
          t.meta,
          t.descricao,
          t.responsavel,
          STATUS_ROTULO[t.status] ?? t.status,
          dataBr(t.prazo),
          dataBr(t.prazoOriginal),
          dataBr(t.concluidoEm),
          t.reprogramacoes,
          `${t.subtarefas.feitas}/${t.subtarefas.total}`,
          t.evidencias.total,
          t.evidencias.aprovadas,
        ]
          .map(csvCampo)
          .join(";"),
      );
    }

    await writeAudit({
      user: req.user,
      action: "EXPORT_CSV",
      entity: "Relatorio",
      after: { tipo: "prestacao.csv", filtros: data.filtros, linhas: data.tarefas.length },
      ip: req.ip,
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="cip-prestacao-de-contas.csv"');
    res.send(`\uFEFF${linhas.join("\n")}`);
  } catch (err) {
    next(err);
  }
});
