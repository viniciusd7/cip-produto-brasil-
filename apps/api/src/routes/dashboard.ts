import { Router } from "express";
import { prisma } from "@cip/db";
import { requireAuth, requirePermission } from "../middleware/auth";
import { prazoStatus } from "../services/prazo";
import {
  classificarSecretaria,
  derivarGravidade,
  GRAVIDADE_METODO_VERSAO,
  indicePonderado,
} from "../services/gravidade";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth, requirePermission("iniciativa:read"));

dashboardRouter.get("/resumo", async (req, res, next) => {
  try {
    const municipioId = req.user!.municipioId;
    const iniciativas = await prisma.iniciativa.findMany({
      where: { municipioId },
      include: {
        secretariaPrincipal: true,
        marcos: { include: { reprogramacoes: true } },
        metasExecucao: true,
        impedimentos: {
          where: { status: { in: ["ABERTO", "EM_ENCAMINHAMENTO"] } },
        },
        evidencias: { where: { status: { in: ["DECLARADA", "A_VERIFICAR"] } } },
        verificacoes: { where: { situacao: "PENDENTE" } },
      },
      orderBy: { atualizadoEm: "desc" },
    });

    const dataRef =
      iniciativas.find((i) => i.dataReferencia)?.dataReferencia ?? new Date();
    const fonte =
      iniciativas.find((i) => i.fonte)?.fonte ??
      "Relatório Quinzenal / base operacional CIP";

    type MarcoAgg = {
      id: string;
      iniciativaId: string;
      iniciativaNome: string;
      secretariaId: string;
      secretariaNome: string;
      estruturante: boolean;
      descricao: string;
      status: string;
      gravidade: string | null;
      prazoVigente: Date | null;
      responsavel: string | null;
    };

    const marcosAgg: MarcoAgg[] = [];
    for (const ini of iniciativas) {
      for (const marco of ini.marcos) {
        const st = prazoStatus(marco, ini.dataReferencia ?? dataRef);
        const grav =
          marco.gravidade ||
          derivarGravidade({
            prazoStatus: st,
            prazoOriginal: marco.prazoOriginal,
            prazoVigente: marco.prazoVigente,
            reprogramacoes: marco.reprogramacoes.length,
            dataReferencia: ini.dataReferencia ?? dataRef,
          });
        marcosAgg.push({
          id: marco.id,
          iniciativaId: ini.id,
          iniciativaNome: ini.nome,
          secretariaId: ini.secretariaPrincipalId,
          secretariaNome: ini.secretariaPrincipal.nome,
          estruturante: ini.estruturante,
          descricao: marco.descricao,
          status: st,
          gravidade: grav,
          prazoVigente: marco.prazoVigente,
          responsavel: marco.responsavel,
        });
      }
    }

    type MetaAgg = {
      id: string;
      iniciativaId: string;
      iniciativaNome: string;
      secretariaId: string;
      secretariaNome: string;
      nome: string;
      indicador: string | null;
      alvo: string | null;
      valorAtual: string | null;
      prazo: Date | null;
      status: string;
      prazoStatus: string;
    };

    const metaConcluida = (status: string) => {
      const v = status.toUpperCase();
      return v.includes("CONCLUID") || v === "ENCERRADA" || v === "ATINGIDA";
    };

    const metasAgg: MetaAgg[] = [];
    for (const ini of iniciativas) {
      const ref = ini.dataReferencia ?? dataRef;
      for (const meta of ini.metasExecucao) {
        const prazoSt = metaConcluida(meta.status)
          ? "CONCLUIDO"
          : prazoStatus(
              { prazoVigente: meta.prazo, concluidoEm: null },
              ref,
            );
        metasAgg.push({
          id: meta.id,
          iniciativaId: ini.id,
          iniciativaNome: ini.nome,
          secretariaId: ini.secretariaPrincipalId,
          secretariaNome: ini.secretariaPrincipal.nome,
          nome: meta.nome,
          indicador: meta.indicador,
          alvo: meta.alvo,
          valorAtual: meta.valorAtual,
          prazo: meta.prazo,
          status: meta.status,
          prazoStatus: prazoSt,
        });
      }
    }

    const metasTotal = metasAgg.length;
    const metasComIndicador = metasAgg.filter((m) => !!m.indicador?.trim()).length;
    const metasComValor = metasAgg.filter((m) => !!m.valorAtual?.trim()).length;
    const metasAtrasadas = metasAgg.filter((m) => m.prazoStatus === "VENCIDO");
    const metasSemPrazo = metasAgg.filter((m) => m.prazoStatus === "SEM_PRAZO");
    const metasConcluidas = metasAgg.filter((m) => m.prazoStatus === "CONCLUIDO").length;
    const metasCobertura = metasTotal
      ? Math.round((metasComValor / metasTotal) * 1000) / 10
      : 0;

    const totalTarefas = marcosAgg.length;
    const concluidas = marcosAgg.filter((m) => m.status === "CONCLUIDO").length;
    const atrasadas = marcosAgg.filter((m) => m.status === "VENCIDO");
    const semPrazo = marcosAgg.filter((m) => m.status === "SEM_PRAZO");
    const noPrazo = marcosAgg.filter((m) => m.status === "NO_PRAZO");
    const abertas = totalTarefas - concluidas;
    const pctAtrasoAbertas = abertas
      ? Math.round((atrasadas.length / abertas) * 1000) / 10
      : 0;
    const indice = indicePonderado(atrasadas, abertas || 1);

    const projetosComAtraso = iniciativas.filter((i) =>
      i.marcos.some(
        (m) => prazoStatus(m, i.dataReferencia ?? dataRef) === "VENCIDO",
      ),
    );
    const atencaoExecutiva = iniciativas.filter((i) => {
      const atrasos = i.marcos.filter(
        (m) => prazoStatus(m, i.dataReferencia ?? dataRef) === "VENCIDO",
      );
      if (!atrasos.length) return false;
      if (i.estruturante) return true;
      return atrasos.some((m) => {
        const g =
          m.gravidade ||
          derivarGravidade({
            prazoStatus: "VENCIDO",
            prazoOriginal: m.prazoOriginal,
            prazoVigente: m.prazoVigente,
            reprogramacoes: m.reprogramacoes.length,
            dataReferencia: i.dataReferencia ?? dataRef,
          });
        return g === "CRITICA" || g === "GRAVE";
      });
    });

    const now = dataRef;
    const in15 = new Date(now);
    in15.setDate(in15.getDate() + 15);

    const secretarias = await prisma.secretaria.findMany({
      where: { municipioId, active: true },
      orderBy: { nome: "asc" },
    });

    const porSecretaria = secretarias.map((s) => {
      const inis = iniciativas.filter((i) => i.secretariaPrincipalId === s.id);
      const marcos = marcosAgg.filter((m) => m.secretariaId === s.id);
      const total = marcos.length;
      const conc = marcos.filter((m) => m.status === "CONCLUIDO").length;
      const atr = marcos.filter((m) => m.status === "VENCIDO");
      const sem = marcos.filter((m) => m.status === "SEM_PRAZO");
      const ab = total - conc;
      const pctAtr = ab ? Math.round((atr.length / ab) * 1000) / 10 : 0;
      const pctSem = ab ? Math.round((sem.length / ab) * 1000) / 10 : 0;
      const idx = indicePonderado(atr, ab || 1);
      const last = inis
        .map((i) => i.atualizadoEm)
        .sort((a, b) => b.getTime() - a.getTime())[0];
      const dias = last
        ? Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      const classificacao = classificarSecretaria({
        diasSemAtualizacao: dias,
        pctAtrasoAbertas: pctAtr,
        indicePonderado: idx,
        pctSemPrazoAbertas: pctSem,
      });
      const maiorAtrasoDias = atr.reduce((max, m) => {
        if (!m.prazoVigente) return max;
        const d = Math.floor(
          (now.getTime() - m.prazoVigente.getTime()) / (1000 * 60 * 60 * 24),
        );
        return Math.max(max, d);
      }, 0);

      const metasSec = metasAgg.filter((m) => m.secretariaId === s.id);
      return {
        id: s.id,
        nome: s.nome,
        sigla: s.sigla,
        titular: {
          nome: s.titularNome,
          cargo: s.titularCargo,
          telefone: s.titularTelefone,
          email: s.titularEmail,
        },
        projetos: inis.length,
        projetosComAtraso: projetosComAtraso.filter((i) => i.secretariaPrincipalId === s.id).length,
        projetosAtencaoExecutiva: atencaoExecutiva.filter((i) => i.secretariaPrincipalId === s.id).length,
        estruturantes: inis.filter((i) => i.estruturante).length,
        tarefasTotal: total,
        abertas: ab,
        concluidas: conc,
        atrasadas: atr.length,
        criticas: atr.filter((m) => m.gravidade === "CRITICA").length,
        semPrazo: sem.length,
        noPrazo: marcos.filter((m) => m.status === "NO_PRAZO").length,
        pctAtraso: pctAtr,
        indicePonderado: idx,
        metasTotal: metasSec.length,
        metasComValor: metasSec.filter((m) => !!m.valorAtual?.trim()).length,
        metasAtrasadas: metasSec.filter((m) => m.prazoStatus === "VENCIDO").length,
        metasSemPrazo: metasSec.filter((m) => m.prazoStatus === "SEM_PRAZO").length,
        maiorAtrasoDias,
        atualizadoEm: last?.toISOString() ?? null,
        diasSemAtualizacao: dias,
        classificacao,
        pendencias: inis.reduce((acc, i) => acc + i.impedimentos.length, 0),
      };
    });

    const entraves = Object.entries(
      iniciativas
        .flatMap((i) => i.impedimentos)
        .reduce<Record<string, number>>((acc, p) => {
          const key = (p.tipo || "OUTROS").toUpperCase();
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {}),
    )
      .map(([tipo, qtd]) => ({ tipo, qtd }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 8);

    const estruturantesAtrasados = marcosAgg.filter(
      (m) => m.estruturante && m.status === "VENCIDO",
    ).length;

    const pastasDesatualizadas = porSecretaria
      .filter((s) => s.classificacao === "DADOS_DEFASADOS")
      .map((s) => ({
        id: s.id,
        nome: s.nome,
        dias: s.diasSemAtualizacao,
      }));

    const gravidadeBuckets = {
      LEVE: atrasadas.filter((a) => a.gravidade === "LEVE").length,
      MODERADA: atrasadas.filter((a) => a.gravidade === "MODERADA").length,
      GRAVE: atrasadas.filter((a) => a.gravidade === "GRAVE").length,
      CRITICA: atrasadas.filter((a) => a.gravidade === "CRITICA").length,
    };

    const tarefasPedemAcao = {
      atrasadas: atrasadas.slice(0, 20).map((m) => ({
        id: m.id,
        descricao: m.descricao,
        iniciativaId: m.iniciativaId,
        iniciativaNome: m.iniciativaNome,
        secretaria: m.secretariaNome,
        gravidade: m.gravidade,
        responsavel: m.responsavel,
      })),
      vencemEm15d: marcosAgg
        .filter(
          (m) =>
            m.status === "NO_PRAZO" &&
            m.prazoVigente &&
            m.prazoVigente <= in15,
        )
        .slice(0, 20)
        .map((m) => ({
          id: m.id,
          descricao: m.descricao,
          iniciativaId: m.iniciativaId,
          iniciativaNome: m.iniciativaNome,
          secretaria: m.secretariaNome,
          prazo: m.prazoVigente?.toISOString() ?? null,
        })),
      semPrazo: semPrazo.slice(0, 20).map((m) => ({
        id: m.id,
        descricao: m.descricao,
        iniciativaId: m.iniciativaId,
        iniciativaNome: m.iniciativaNome,
        secretaria: m.secretariaNome,
      })),
    };

    res.json({
      data: {
        governo: {
          totalProjetos: iniciativas.length,
          projetosComAtraso: projetosComAtraso.length,
          pctCarteiraComAtraso: iniciativas.length
            ? Math.round(
                (projetosComAtraso.length / iniciativas.length) * 1000,
              ) / 10
            : 0,
          semAtrasoRegistrado:
            iniciativas.length - projetosComAtraso.length,
          atencaoExecutiva: atencaoExecutiva.length,
          totalTarefas,
          concluidas,
          abertas,
          atrasadas: atrasadas.length,
          semPrazo: semPrazo.length,
          noPrazo: noPrazo.length,
          pctAtrasoAbertas,
          indicePonderado: indice,
          metodoVersao: GRAVIDADE_METODO_VERSAO,
        },
        metas: {
          total: metasTotal,
          comIndicador: metasComIndicador,
          comValor: metasComValor,
          cobertura: metasCobertura,
          atrasadas: metasAtrasadas.length,
          semPrazo: metasSemPrazo.length,
          concluidas: metasConcluidas,
          pedemAcao: metasAtrasadas.slice(0, 10).map((m) => ({
            id: m.id,
            nome: m.nome,
            iniciativaId: m.iniciativaId,
            iniciativaNome: m.iniciativaNome,
            secretaria: m.secretariaNome,
            valorAtual: m.valorAtual,
            alvo: m.alvo,
            prazo: m.prazo?.toISOString() ?? null,
          })),
        },
        kpis: {
          totalIniciativas: iniciativas.length,
          emAcompanhamento: iniciativas.filter(
            (i) => i.ciclo === "EM_ACOMPANHAMENTO",
          ).length,
          pendenciasAbertas: iniciativas.reduce(
            (acc, i) =>
              acc +
              i.impedimentos.length +
              i.verificacoes.length +
              i.evidencias.length,
            0,
          ),
          vencidas: atrasadas.length,
          semPrazo: semPrazo.length,
          evidenciasPendentes: iniciativas.reduce(
            (acc, i) => acc + i.evidencias.length,
            0,
          ),
          secretariasDesatualizadas: pastasDesatualizadas.length,
          estruturantes: iniciativas.filter((i) => i.estruturante).length,
          concluidas,
        },
        agenda: {
          entraves,
          estruturantesAtrasados,
          pastasDesatualizadas,
          gravidadeBuckets,
        },
        series: {
          atrasoPorSecretaria: porSecretaria
            .filter((s) => s.projetos > 0 || s.tarefasTotal > 0)
            .map((s) => ({
              id: s.id,
              nome: s.nome,
              sigla: s.sigla,
              pctAtraso: s.pctAtraso,
              projetos: s.projetos,
              classificacao: s.classificacao,
              titularNome: s.titular.nome,
              titularTelefone: s.titular.telefone,
            })),
          gravidadeBuckets,
          tarefasStatus: {
            noPrazo: noPrazo.length,
            atrasadas: atrasadas.length,
            semPrazo: semPrazo.length,
            concluidas,
          },
          fluxoInfo: {
            planos: await prisma.planoGoverno.count({ where: { municipioId } }),
            secretarias: secretarias.length,
            projetos: iniciativas.length,
            metasExec: metasTotal,
            tarefas: totalTarefas,
          },
        },
        tarefasPedemAcao,
        porSecretaria,
        projetosEstruturantes: iniciativas
          .filter((i) => i.estruturante)
          .slice(0, 12)
          .map((i) => {
            const st = statusPor(i, dataRef);
            return {
              id: i.id,
              codigo: i.codigo,
              nome: i.nome,
              secretaria: i.secretariaPrincipal.nome,
              ciclo: i.ciclo,
              pendencias: i.impedimentos.length,
              marcos: i.marcos.length,
              atrasadas: st.vencidas,
              atualizadoEm: i.atualizadoEm.toISOString(),
            };
          }),
        pendencias: [
          ...iniciativas.flatMap((i) =>
            i.impedimentos.map((p) => ({
              id: p.id,
              tipo: "IMPEDIMENTO" as const,
              titulo: p.descricao,
              status: p.status,
              responsavel: p.responsavel,
              prazo: p.prazo?.toISOString() ?? null,
              iniciativaId: i.id,
              iniciativaNome: i.nome,
              href: `/iniciativas/${i.id}?aba=andamento`,
            })),
          ),
          ...iniciativas.flatMap((i) =>
            i.evidencias.map((e) => ({
              id: e.id,
              tipo: "EVIDENCIA" as const,
              titulo: e.titulo,
              status: e.status,
              responsavel: e.autorNome,
              prazo: null as string | null,
              iniciativaId: i.id,
              iniciativaNome: i.nome,
              href: `/iniciativas/${i.id}?aba=evidencias`,
            })),
          ),
        ].slice(0, 40),
      },
      meta: {
        dataReferencia: dataRef.toISOString(),
        fonte,
        metodoVersao: GRAVIDADE_METODO_VERSAO,
      },
    });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get("/pasta-resumo", async (req, res, next) => {
  try {
    const municipioId = req.user!.municipioId;
    const secretariaId = String(req.query.secretariaId || "");
    const resumo = await prisma.secretaria.findMany({
      where: { municipioId, active: true },
      orderBy: { nome: "asc" },
    });

    // Reuse /resumo aggregation lightly via redirect logic in client;
    // here return focused pasta + projects.
    const secretarias = resumo;
    let pasta =
      (secretariaId && secretarias.find((s) => s.id === secretariaId)) || null;

    const iniciativas = await prisma.iniciativa.findMany({
      where: { municipioId },
      include: {
        secretariaPrincipal: true,
        marcos: { include: { reprogramacoes: true } },
        impedimentos: {
          where: { status: { in: ["ABERTO", "EM_ENCAMINHAMENTO"] } },
        },
      },
      orderBy: { atualizadoEm: "desc" },
    });
    const dataRef =
      iniciativas.find((i) => i.dataReferencia)?.dataReferencia ?? new Date();

    const scored = secretarias.map((s) => {
      const inis = iniciativas.filter((i) => i.secretariaPrincipalId === s.id);
      const marcos = inis.flatMap((i) =>
        i.marcos.map((m) => ({
          st: prazoStatus(m, i.dataReferencia ?? dataRef),
        })),
      );
      const total = marcos.length;
      const conc = marcos.filter((m) => m.st === "CONCLUIDO").length;
      const atr = marcos.filter((m) => m.st === "VENCIDO").length;
      const sem = marcos.filter((m) => m.st === "SEM_PRAZO").length;
      const no = marcos.filter((m) => m.st === "NO_PRAZO").length;
      const ab = total - conc;
      const pctAtr = ab ? Math.round((atr / ab) * 1000) / 10 : 0;
      const last = inis
        .map((i) => i.atualizadoEm)
        .sort((a, b) => b.getTime() - a.getTime())[0];
      const dias = last
        ? Math.floor((dataRef.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      const classificacao = classificarSecretaria({
        diasSemAtualizacao: dias,
        pctAtrasoAbertas: pctAtr,
        indicePonderado: indicePonderado(
          inis.flatMap((i) =>
            i.marcos
              .filter(
                (m) => prazoStatus(m, i.dataReferencia ?? dataRef) === "VENCIDO",
              )
              .map((m) => ({
                gravidade:
                  m.gravidade ||
                  derivarGravidade({
                    prazoStatus: "VENCIDO",
                    prazoOriginal: m.prazoOriginal,
                    prazoVigente: m.prazoVigente,
                    reprogramacoes: m.reprogramacoes.length,
                    dataReferencia: i.dataReferencia ?? dataRef,
                  }),
              })),
          ),
          ab || 1,
        ),
        pctSemPrazoAbertas: ab ? Math.round((sem / ab) * 1000) / 10 : 0,
      });
      return {
        secretaria: s,
        classificacao,
        pctAtraso: pctAtr,
        tarefasStatus: {
          noPrazo: no,
          atrasadas: atr,
          semPrazo: sem,
          concluidas: conc,
        },
        projetos: inis.map((i) => ({
          id: i.id,
          codigo: i.codigo,
          nome: i.nome,
          ciclo: i.ciclo,
          estruturante: i.estruturante,
          pendencias: i.impedimentos.length,
          atrasadas: i.marcos.filter(
            (m) => prazoStatus(m, i.dataReferencia ?? dataRef) === "VENCIDO",
          ).length,
        })),
      };
    });

    if (!pasta) {
      const worst = [...scored].sort((a, b) => {
        const rank = (c: string) =>
          c === "INTERVENCAO" ? 0 : c === "ACOMPANHAMENTO" ? 1 : c === "DADOS_DEFASADOS" ? 2 : 3;
        const r = rank(a.classificacao) - rank(b.classificacao);
        if (r !== 0) return r;
        return b.pctAtraso - a.pctAtraso;
      })[0];
      pasta = worst?.secretaria || secretarias[0] || null;
    }

    const focus = scored.find((s) => s.secretaria.id === pasta?.id) || scored[0];
    if (!focus) {
      return res.json({
        data: null,
        meta: { message: "Nenhuma secretaria cadastrada" },
      });
    }

    res.json({
      data: {
        secretaria: {
          id: focus.secretaria.id,
          nome: focus.secretaria.nome,
          sigla: focus.secretaria.sigla,
          titular: {
            nome: focus.secretaria.titularNome,
            cargo: focus.secretaria.titularCargo,
            telefone: focus.secretaria.titularTelefone,
            email: focus.secretaria.titularEmail,
          },
        },
        classificacao: focus.classificacao,
        pctAtraso: focus.pctAtraso,
        tarefasStatus: focus.tarefasStatus,
        projetos: focus.projetos,
      },
      meta: {
        dataReferencia: dataRef.toISOString(),
        metodoVersao: GRAVIDADE_METODO_VERSAO,
      },
    });
  } catch (err) {
    next(err);
  }
});

function statusPor(
  ini: {
    dataReferencia: Date | null;
    marcos: Array<{
      prazoOriginal: Date | null;
      prazoVigente: Date | null;
      concluidoEm: Date | null;
    }>;
  },
  fallback: Date,
) {
  let vencidas = 0;
  let semPrazo = 0;
  for (const m of ini.marcos) {
    const st = prazoStatus(m, ini.dataReferencia ?? fallback);
    if (st === "VENCIDO") vencidas += 1;
    if (st === "SEM_PRAZO") semPrazo += 1;
  }
  return { vencidas, semPrazo };
}
