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
