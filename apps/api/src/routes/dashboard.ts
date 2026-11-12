import { Router } from "express";
import { prisma } from "@cip/db";
import {
  assertSecretariaAccess,
  iniciativaScopeFilter,
  requireAuth,
  requirePermission,
} from "../middleware/auth";
import { prazoStatus } from "../services/prazo";
import { progressoIndicador } from "../services/indicadores";
import { HttpError } from "../middleware/error";
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
      where: { municipioId, AND: [iniciativaScopeFilter(req.user!)] },
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
      where: {
        municipioId,
        active: true,
        ...(req.user!.role === "gestor"
          ? { id: req.user!.secretariaId || "__no_secretaria__" }
          : {}),
      },
      orderBy: { nome: "asc" },
    });
    if (!secretarias.length) {
      throw new HttpError(
        403,
        "SECRETARIA_REQUIRED",
        "Este usuário ainda não tem uma secretaria vinculada",
      );
    }

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

    const parseNum = (v: string | null | undefined) => {
      if (!v) return null;
      const n = Number(String(v).replace(",", ".").replace(/[^\d.-]/g, ""));
      return Number.isFinite(n) ? n : null;
    };

    const metasEstrategicas = await prisma.metaEstrategica.findMany({
      where: {
        plano: { municipioId },
        ...(req.user!.role === "gestor"
          ? {
              OR: [
                { secretariaId: req.user!.secretariaId || "__no_secretaria__" },
                { secretariaId: null },
              ],
            }
          : {}),
      },
      include: {
        secretaria: true,
        plano: true,
        medicoes: { orderBy: { dataCorte: "desc" }, take: 2 },
        _count: {
          select: {
            iniciativas:
              req.user!.role === "gestor"
                ? { where: { AND: [iniciativaScopeFilter(req.user!)] } }
                : true,
          },
        },
      },
      orderBy: { nome: "asc" },
    });

    const estrategiaMetas = metasEstrategicas.map((m) => {
      const atual = m.medicoes[0];
      const anterior = m.medicoes[1];
      const realizado = parseNum(atual?.valorRealizado ?? null);
      const esperado = parseNum(atual?.valorEsperado ?? null);
      const desvio =
        realizado != null && esperado != null ? realizado - esperado : null;
      return {
        id: m.id,
        nome: m.nome,
        codigo: m.codigo,
        secretariaId: m.secretariaId,
        secretariaNome: m.secretaria?.nome ?? null,
        indicador: m.indicador,
        valorBase: m.valorBase,
        alvo: m.alvo,
        unidade: m.unidade,
        periodicidade: m.periodicidade,
        statusValidacao: m.statusValidacao,
        perspectivaBsc: m.perspectivaBsc,
        resultadoChaveOkr: m.resultadoChaveOkr,
        projetos: m._count.iniciativas,
        medicaoAtual: atual
          ? {
              dataCorte: atual.dataCorte.toISOString(),
              valorRealizado: atual.valorRealizado,
              valorEsperado: atual.valorEsperado,
              fonte: atual.fonte,
              confiabilidade: atual.confiabilidade,
            }
          : null,
        medicaoAnterior: anterior
          ? {
              dataCorte: anterior.dataCorte.toISOString(),
              valorRealizado: anterior.valorRealizado,
            }
          : null,
        desvio,
        aguardandoMedicao: !atual,
      };
    });

    const docsPendentes =
      req.user!.role === "gestor"
        ? []
        : await prisma.documentoConhecimento.findMany({
            where: {
              municipioId,
              tipo: { in: ["PPA", "LDO", "LOA"] },
              statusConferencia: { not: "CONFERIDO" },
            },
            select: {
              id: true,
              tipo: true,
              titulo: true,
              statusConferencia: true,
            },
          });

    const equipamentosAlerta = await prisma.equipamentoPublico.findMany({
      where: {
        municipioId,
        ...(req.user!.role === "gestor"
          ? {
              iniciativas: {
                some: {
                  iniciativa: {
                    AND: [iniciativaScopeFilter(req.user!)],
                  },
                },
              },
            }
          : {}),
      },
      include: {
        iniciativas: {
          where: {
            iniciativa: { AND: [iniciativaScopeFilter(req.user!)] },
          },
          include: {
            iniciativa: {
              include: {
                marcos: { include: { reprogramacoes: true } },
                secretariaPrincipal: true,
              },
            },
          },
        },
      },
    });
    const alertaEquipamentos = equipamentosAlerta
      .map((eq) => {
        const frentes = eq.iniciativas.map((v) => {
          const ini = v.iniciativa;
          const atrasos = ini.marcos.filter(
            (marco) =>
              prazoStatus(marco, ini.dataReferencia ?? dataRef) === "VENCIDO",
          ).length;
          return {
            iniciativaId: ini.id,
            nome: ini.nome,
            secretaria: ini.secretariaPrincipal.nome,
            atrasos,
          };
        });
        const comAtraso = frentes.filter((f) => f.atrasos > 0);
        return comAtraso.length
          ? { id: eq.id, nome: eq.nome, frentesComAtraso: comAtraso }
          : null;
      })
      .filter(Boolean);

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
        estrategia: {
          metas: estrategiaMetas,
          porPerspectivaBsc: ["FINANCEIRA", "CLIENTES", "PROCESSOS", "APRENDIZADO"].map(
            (p) => ({
              perspectiva: p,
              total: estrategiaMetas.filter((m) => m.perspectivaBsc === p).length,
              comMedicao: estrategiaMetas.filter(
                (m) => m.perspectivaBsc === p && m.medicaoAtual,
              ).length,
            }),
          ),
          alertasOrcamento: docsPendentes,
          alertaEquipamentos,
        },
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

dashboardRouter.get("/agenda", async (req, res, next) => {
  try {
    const municipioId = req.user!.municipioId;
    const iniciativas = await prisma.iniciativa.findMany({
      where: {
        municipioId,
        AND: [iniciativaScopeFilter(req.user!)],
      },
      select: {
        id: true,
        codigo: true,
        nome: true,
        ciclo: true,
        estruturante: true,
        bloqueioLabel: true,
        atualizadoEm: true,
        dataReferencia: true,
        secretariaPrincipal: { select: { id: true, nome: true } },
        secretarias: {
          select: {
            papel: true,
            secretaria: { select: { id: true, nome: true } },
          },
        },
        metasExecucao: { select: { id: true, nome: true } },
        marcos: {
          include: {
            metaExecucao: { select: { id: true, nome: true } },
            subtarefas: { select: { id: true, concluida: true } },
          },
          orderBy: [{ ordem: "asc" }, { prazoVigente: "asc" }],
        },
        impedimentos: {
          where: { status: { in: ["ABERTO", "EM_ENCAMINHAMENTO"] } },
        },
        evidencias: {
          where: { status: { in: ["DECLARADA", "A_VERIFICAR"] } },
        },
        verificacoes: {
          where: { situacao: "PENDENTE" },
          include: { tipo: { select: { nome: true } } },
        },
        decisoes: {
          where: { status: { in: ["ABERTA", "EM_ANDAMENTO"] } },
        },
      },
      orderBy: { atualizadoEm: "desc" },
    });

    const dataReferencia =
      iniciativas.find((iniciativa) => iniciativa.dataReferencia)
        ?.dataReferencia ?? new Date();
    const marcoIds = iniciativas.flatMap((iniciativa) => iniciativa.marcos.map((marco) => marco.id));
    const validacoesAbertas = marcoIds.length
      ? await prisma.solicitacaoValidacao.findMany({
          where: { entidadeTipo: "MARCO", entidadeId: { in: marcoIds }, tipo: "CONCLUSAO", status: "ABERTA" },
          select: { entidadeId: true },
        })
      : [];
    const aguardandoValidacao = new Set(validacoesAbertas.map((v) => v.entidadeId));
    const tarefas = iniciativas.flatMap((iniciativa) =>
      iniciativa.marcos.map((marco) => ({
        id: marco.id,
        codigo: marco.codigo,
        descricao: marco.descricao,
        status: marco.concluidoEm
          ? "CONCLUIDO"
          : marco.encerradoSemSolucaoEm
            ? "ENCERRADO_SEM_SOLUCAO"
            : prazoStatus(marco, iniciativa.dataReferencia ?? dataReferencia),
        responsavel: marco.responsavel,
        responsavelUserId: marco.responsavelUserId,
        minha: marco.responsavelUserId === req.user!.id,
        aguardandoValidacao: aguardandoValidacao.has(marco.id),
        prazo: marco.prazoVigente?.toISOString() ?? null,
        meta: marco.metaExecucao?.nome ?? null,
        metaExecucaoId: marco.metaExecucao?.id ?? null,
        subtarefas: {
          total: marco.subtarefas.length,
          concluidas: marco.subtarefas.filter((subtarefa) => subtarefa.concluida)
            .length,
        },
        iniciativaId: iniciativa.id,
        iniciativaCodigo: iniciativa.codigo,
        iniciativaNome: iniciativa.nome,
        secretaria: iniciativa.secretariaPrincipal.nome,
      })),
    );

    const pendencias = iniciativas.flatMap((iniciativa) => [
      ...iniciativa.impedimentos.map((item) => ({
        id: item.id,
        tipo: "IMPEDIMENTO",
        titulo: item.descricao,
        status: item.status,
        responsavel: item.responsavel,
        prazo: item.prazo?.toISOString() ?? null,
        iniciativaId: iniciativa.id,
        iniciativaNome: iniciativa.nome,
        href: `/iniciativas/${iniciativa.id}?aba=andamento`,
      })),
      ...iniciativa.evidencias.map((item) => ({
        id: item.id,
        tipo: "EVIDENCIA",
        titulo: item.titulo,
        status: item.status,
        responsavel: item.autorNome,
        prazo: null,
        iniciativaId: iniciativa.id,
        iniciativaNome: iniciativa.nome,
        href: `/iniciativas/${iniciativa.id}?aba=evidencias`,
      })),
      ...iniciativa.verificacoes.map((item) => ({
        id: item.id,
        tipo: "VERIFICACAO",
        titulo: item.tipo.nome,
        status: item.situacao,
        responsavel: item.responsavel,
        prazo: null,
        iniciativaId: iniciativa.id,
        iniciativaNome: iniciativa.nome,
        href: `/iniciativas/${iniciativa.id}?aba=visao`,
      })),
      ...iniciativa.decisoes.map((item) => ({
        id: item.id,
        tipo: "DECISAO",
        titulo: item.descricao,
        status: item.status,
        responsavel: item.responsavel,
        prazo: item.prazo?.toISOString() ?? null,
        iniciativaId: iniciativa.id,
        iniciativaNome: iniciativa.nome,
        href: `/iniciativas/${iniciativa.id}?aba=andamento`,
      })),
    ]);

    const prioridadeStatus: Record<string, number> = {
      VENCIDO: 0,
      SEM_PRAZO: 1,
      NO_PRAZO: 2,
      CONCLUIDO: 3,
      ENCERRADO_SEM_SOLUCAO: 4,
    };
    tarefas.sort((a, b) => {
      const prioridade = prioridadeStatus[a.status] - prioridadeStatus[b.status];
      if (prioridade) return prioridade;
      if (!a.prazo) return b.prazo ? 1 : 0;
      if (!b.prazo) return -1;
      return a.prazo.localeCompare(b.prazo);
    });
    const tarefasPorIniciativa = new Map<
      string,
      (typeof tarefas)[number][]
    >();
    for (const tarefa of tarefas) {
      const tarefasProjeto = tarefasPorIniciativa.get(tarefa.iniciativaId) ?? [];
      tarefasProjeto.push(tarefa);
      tarefasPorIniciativa.set(tarefa.iniciativaId, tarefasProjeto);
    }
    const projetos = iniciativas.map((iniciativa) => {
      const tarefasProjeto = tarefasPorIniciativa.get(iniciativa.id) ?? [];
      const concluidas = tarefasProjeto.filter(
        (tarefa) => tarefa.status === "CONCLUIDO",
      ).length;
      return {
        id: iniciativa.id,
        codigo: iniciativa.codigo,
        nome: iniciativa.nome,
        ciclo: iniciativa.ciclo,
        estruturante: iniciativa.estruturante,
        bloqueioLabel: iniciativa.bloqueioLabel,
        atualizadoEm: iniciativa.atualizadoEm.toISOString(),
        secretariaPrincipal: iniciativa.secretariaPrincipal,
        secretariasCorrelacionadas: iniciativa.secretarias
          .filter(
            (vinculo) =>
              vinculo.secretaria.id !== iniciativa.secretariaPrincipal.id,
          )
          .map((vinculo) => ({
            papel: vinculo.papel,
            secretaria: vinculo.secretaria,
          })),
        tarefas: {
          total: tarefasProjeto.length,
          concluidas,
          atrasadas: tarefasProjeto.filter(
            (tarefa) => tarefa.status === "VENCIDO",
          ).length,
          semPrazo: tarefasProjeto.filter(
            (tarefa) => tarefa.status === "SEM_PRAZO",
          ).length,
          noPrazo: tarefasProjeto.filter(
            (tarefa) => tarefa.status === "NO_PRAZO",
          ).length,
          pctConclusao: tarefasProjeto.length
            ? Math.round((concluidas / tarefasProjeto.length) * 100)
            : 0,
        },
        providenciasAbertas: {
          impedimentos: iniciativa.impedimentos.length,
          evidencias: iniciativa.evidencias.length,
          verificacoes: iniciativa.verificacoes.length,
          decisoes: iniciativa.decisoes.length,
        },
      };
    });
    res.json({
      data: { projetos, tarefas, pendencias },
      meta: {
        totalProjetos: projetos.length,
        totalTarefas: tarefas.length,
        totalPendencias: pendencias.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get("/cenario-secretaria", async (req, res, next) => {
  try {
    const municipioId = req.user!.municipioId;
    const secretariaIdParam = String(req.query.secretariaId || "").trim();
    const secretariaPermitida =
      req.user!.role === "gestor" ? req.user!.secretariaId : null;
    const secretarias = await prisma.secretaria.findMany({
      where: {
        municipioId,
        active: true,
        ...(secretariaPermitida ? { id: secretariaPermitida } : {}),
      },
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        sigla: true,
        titularNome: true,
        titularCargo: true,
      },
    });

    if (!secretarias.length) {
      return res.json({
        data: { secretarias: [], selected: null },
        meta: { message: "Nenhuma secretaria cadastrada" },
      });
    }

    const selectedId =
      (secretariaIdParam &&
        secretarias.some((s) => s.id === secretariaIdParam) &&
        secretariaIdParam) ||
      secretarias[0].id;

    await assertSecretariaAccess(req.user!, selectedId);
    const selectedMeta = secretarias.find((s) => s.id === selectedId)!;

    const parseNum = (v: string | null | undefined) => {
      if (!v) return null;
      const n = Number(String(v).replace(",", ".").replace(/[^\d.-]/g, ""));
      return Number.isFinite(n) ? n : null;
    };

    const metasEstrategicas = await prisma.metaEstrategica.findMany({
      where: {
        plano: { municipioId },
        OR: [{ secretariaId: selectedId }, { secretariaId: null }],
      },
      include: {
        medicoes: { orderBy: { dataCorte: "desc" }, take: 2 },
        _count: {
          select: {
            iniciativas:
              req.user!.role === "gestor"
                ? { where: { AND: [iniciativaScopeFilter(req.user!)] } }
                : true,
          },
        },
      },
      orderBy: { nome: "asc" },
    });

    const metasEstrategicasDaPasta = metasEstrategicas.filter(
      (m) => m.secretariaId === selectedId,
    );

    const iniciativas = await prisma.iniciativa.findMany({
      where: {
        municipioId,
        AND: [
          {
            OR: [
              { secretariaPrincipalId: selectedId },
              { secretarias: { some: { secretariaId: selectedId } } },
            ],
          },
          iniciativaScopeFilter(req.user!),
        ],
      },
      include: {
        metasExecucao: true,
        marcos: true,
        metaEstrategica: true,
      },
      orderBy: { atualizadoEm: "desc" },
    });

    const dataRef =
      iniciativas.find((i) => i.dataReferencia)?.dataReferencia ?? new Date();

    const metaConcluida = (status: string) => {
      const v = status.toUpperCase();
      return v.includes("CONCLUID") || v === "ENCERRADA" || v === "ATINGIDA";
    };

    const metasExecucao = iniciativas.flatMap((ini) =>
      ini.metasExecucao.map((meta) => {
        const prazoSt = metaConcluida(meta.status)
          ? "CONCLUIDO"
          : prazoStatus({ prazoVigente: meta.prazo, concluidoEm: null }, dataRef);
        return {
          id: meta.id,
          nome: meta.nome,
          indicador: meta.indicador,
          alvo: meta.alvo,
          valorAtual: meta.valorAtual,
          unidade: meta.unidade,
          prazo: meta.prazo?.toISOString() ?? null,
          status: meta.status,
          prazoStatus: prazoSt,
          iniciativaId: ini.id,
          iniciativaNome: ini.nome,
          iniciativaCodigo: ini.codigo,
          metaEstrategicaNome: ini.metaEstrategica?.nome ?? null,
        };
      }),
    );

    const marcos = iniciativas.flatMap((ini) =>
      ini.marcos.map((m) => prazoStatus(m, ini.dataReferencia ?? dataRef)),
    );
    const totalTarefas = marcos.length;
    const concluidas = marcos.filter((st) => st === "CONCLUIDO").length;
    const atrasadas = marcos.filter((st) => st === "VENCIDO").length;
    const semPrazo = marcos.filter((st) => st === "SEM_PRAZO").length;
    const noPrazo = marcos.filter((st) => st === "NO_PRAZO").length;

    const projetos = iniciativas.map((ini) => {
      const estados = ini.marcos.map((m) => prazoStatus(m, ini.dataReferencia ?? dataRef));
      const total = estados.length;
      const feitas = estados.filter((st) => st === "CONCLUIDO").length;
      return {
        id: ini.id,
        codigo: ini.codigo,
        nome: ini.nome,
        participacao: ini.secretariaPrincipalId === selectedId ? "PRINCIPAL" : "CORRELACIONADO",
        totalTarefas: total,
        concluidas: feitas,
        atrasadas: estados.filter((st) => st === "VENCIDO").length,
        semPrazo: estados.filter((st) => st === "SEM_PRAZO").length,
        pctConclusao: total ? Math.round((feitas / total) * 100) : 0,
      };
    });

    const em15d = new Date(dataRef.getTime() + 15 * 86400000);
    const tarefasAtencao = iniciativas
      .flatMap((ini) =>
        ini.marcos.map((m) => ({
          id: m.id,
          descricao: m.descricao,
          prazo: m.prazoVigente?.toISOString() ?? null,
          responsavel: m.responsavel,
          estado: prazoStatus(m, ini.dataReferencia ?? dataRef),
          venceLogo: !!m.prazoVigente && !m.concluidoEm && m.prazoVigente >= dataRef && m.prazoVigente <= em15d,
          iniciativaId: ini.id,
          iniciativaNome: ini.nome,
        })),
      )
      .filter((t) => t.estado === "VENCIDO" || (t.estado === "NO_PRAZO" && t.venceLogo))
      .sort((a, b) =>
        (a.estado === "VENCIDO" ? 0 : 1) - (b.estado === "VENCIDO" ? 0 : 1) ||
        String(a.prazo).localeCompare(String(b.prazo)),
      )
      .slice(0, 6)
      .map(({ venceLogo: _v, ...t }) => t);

    const metasComValor = metasExecucao.filter((m) => !!m.valorAtual?.trim()).length;
    const metasAtrasadas = metasExecucao.filter((m) => m.prazoStatus === "VENCIDO").length;

    const estrategiaCards = metasEstrategicasDaPasta.map((m) => {
      const atual = m.medicoes[0];
      const realizado = parseNum(atual?.valorRealizado ?? null);
      const esperado = parseNum(atual?.valorEsperado ?? null);
      return {
        id: m.id,
        nome: m.nome,
        codigo: m.codigo,
        indicador: m.indicador,
        valorBase: m.valorBase,
        alvo: m.alvo,
        unidade: m.unidade,
        periodicidade: m.periodicidade,
        statusValidacao: m.statusValidacao,
        perspectivaBsc: m.perspectivaBsc,
        resultadoChaveOkr: m.resultadoChaveOkr,
        projetos: m._count.iniciativas,
        medicaoAtual: atual
          ? {
              dataCorte: atual.dataCorte.toISOString(),
              valorRealizado: atual.valorRealizado,
              valorEsperado: atual.valorEsperado,
              fonte: atual.fonte,
            }
          : null,
        desvio:
          realizado != null && esperado != null ? realizado - esperado : null,
        aguardandoMedicao: !atual,
      };
    });

    res.json({
      data: {
        secretarias: secretarias.map((s) => ({
          id: s.id,
          nome: s.nome,
          sigla: s.sigla,
          titularNome: s.titularNome,
        })),
        selected: {
          id: selectedMeta.id,
          nome: selectedMeta.nome,
          sigla: selectedMeta.sigla,
          titularNome: selectedMeta.titularNome,
          titularCargo: selectedMeta.titularCargo,
        },
        metasEstrategicas: estrategiaCards,
        metasExecucao,
        projetos,
        tarefasAtencao,
        indicadores: {
          projetos: iniciativas.length,
          metasExecucao: metasExecucao.length,
          metasComValor,
          coberturaMetas: metasExecucao.length
            ? Math.round((metasComValor / metasExecucao.length) * 1000) / 10
            : 0,
          metasAtrasadas,
          totalTarefas,
          concluidas,
          atrasadas,
          semPrazo,
          noPrazo,
          pctConclusao: totalTarefas
            ? Math.round((concluidas / totalTarefas) * 1000) / 10
            : 0,
        },
      },
      meta: {
        dataReferencia: dataRef.toISOString(),
        fonte: "Cenário por secretaria · CIP",
      },
    });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get("/pasta-resumo", async (req, res, next) => {
  try {
    const municipioId = req.user!.municipioId;
    const secretariaId =
      req.user!.role === "gestor"
        ? req.user!.secretariaId || ""
        : String(req.query.secretariaId || "");
    const resumo = await prisma.secretaria.findMany({
      where: {
        municipioId,
        active: true,
        ...(req.user!.role === "gestor" ? { id: secretariaId } : {}),
      },
      orderBy: { nome: "asc" },
    });

    // Reuse /resumo aggregation lightly via redirect logic in client;
    // here return focused pasta + projects.
    const secretarias = resumo;
    let pasta =
      (secretariaId && secretarias.find((s) => s.id === secretariaId)) || null;

    const iniciativas = await prisma.iniciativa.findMany({
      where: { municipioId, AND: [iniciativaScopeFilter(req.user!)] },
      include: {
        secretariaPrincipal: true,
        secretarias: { select: { secretariaId: true, papel: true } },
        marcos: { include: { reprogramacoes: true } },
        impedimentos: {
          where: { status: { in: ["ABERTO", "EM_ENCAMINHAMENTO"] } },
        },
      },
      orderBy: { atualizadoEm: "desc" },
    });
    const dataRef =
      iniciativas.find((i) => i.dataReferencia)?.dataReferencia ?? new Date();

    const mapProjeto = (
      i: (typeof iniciativas)[number],
      participacao: "PRINCIPAL" | "CORRELACIONADO",
    ) => {
      const estados = i.marcos.map((marco) =>
        prazoStatus(marco, i.dataReferencia ?? dataRef),
      );
      const totalTarefas = estados.length;
      const concluidas = estados.filter((status) => status === "CONCLUIDO").length;
      const atrasadas = estados.filter((status) => status === "VENCIDO").length;
      const semPrazo = estados.filter((status) => status === "SEM_PRAZO").length;
      return {
        id: i.id,
        codigo: i.codigo,
        nome: i.nome,
        ciclo: i.ciclo,
        estruturante: i.estruturante,
        bloqueioLabel: i.bloqueioLabel,
        participacao,
        pendencias: i.impedimentos.length,
        totalTarefas,
        concluidas,
        atrasadas,
        semPrazo,
        pctConclusao: totalTarefas
          ? Math.round((concluidas / totalTarefas) * 100)
          : 0,
        atualizadoEm: i.atualizadoEm.toISOString(),
        secretariaPrincipalNome: i.secretariaPrincipal.nome,
      };
    };

    const scored = secretarias.map((s) => {
      const principais = iniciativas.filter((i) => i.secretariaPrincipalId === s.id);
      const correlacionados = iniciativas.filter(
        (i) =>
          i.secretariaPrincipalId !== s.id &&
          i.secretarias.some((v) => v.secretariaId === s.id),
      );
      const inis =
        req.user!.role === "gestor"
          ? [...principais, ...correlacionados]
          : principais;
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
        projetosPrincipais: principais.map((iniciativa) =>
          mapProjeto(iniciativa, "PRINCIPAL"),
        ),
        projetosCorrelacionados: correlacionados.map((iniciativa) =>
          mapProjeto(iniciativa, "CORRELACIONADO"),
        ),
        /** @deprecated use projetosPrincipais */
        projetos: principais.map((iniciativa) =>
          mapProjeto(iniciativa, "PRINCIPAL"),
        ),
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

    const idsEmEscopo = [...focus.projetosPrincipais, ...focus.projetosCorrelacionados].map((p) => p.id);
    const [metasEstrategicasRows, metasExecucaoRows] = await Promise.all([
      prisma.metaEstrategica.findMany({
        where: { secretariaId: focus.secretaria.id, plano: { municipioId } },
        include: {
          plano: { select: { nome: true } },
          responsavelUser: { select: { id: true, name: true } },
          indicadores: {
            where: { ativo: true },
            include: {
              responsavelUser: { select: { id: true, name: true } },
              medicoes: { orderBy: { dataCorte: "desc" }, take: 1, select: { dataCorte: true } },
            },
            orderBy: { createdAt: "asc" },
          },
          iniciativas: { select: { id: true } },
        },
        orderBy: [{ codigo: "asc" }, { nome: "asc" }],
      }),
      prisma.metaExecucao.findMany({
        where: { iniciativaId: { in: idsEmEscopo } },
        include: {
          iniciativa: { select: { id: true, codigo: true, nome: true, secretariaPrincipalId: true, dataReferencia: true } },
          responsavelUser: { select: { id: true, name: true } },
          marcos: { select: { prazoOriginal: true, prazoVigente: true, concluidoEm: true, encerradoSemSolucaoEm: true } },
          indicadores: { where: { ativo: true }, select: { id: true, nome: true, valorBase: true, alvo: true, valorAtual: true, unidade: true } },
        },
        orderBy: [{ prazo: "asc" }, { ordem: "asc" }],
      }),
    ]);
    const statusProjeto = new Map(
      [...focus.projetosPrincipais, ...focus.projetosCorrelacionados].map((p) => [p.id, p]),
    );
    const metasEstrategicas = metasEstrategicasRows.map((meta) => {
      const projetosMeta = meta.iniciativas.map((i) => statusProjeto.get(i.id)).filter(Boolean) as Array<
        (typeof focus.projetosPrincipais)[number]
      >;
      const totalTarefas = projetosMeta.reduce((acc, p) => acc + p.totalTarefas, 0);
      const concluidas = projetosMeta.reduce((acc, p) => acc + p.concluidas, 0);
      return {
        id: meta.id,
        codigo: meta.codigo,
        nome: meta.nome,
        plano: meta.plano.nome,
        prazo: meta.prazo?.toISOString() ?? null,
        perspectivaBsc: meta.perspectivaBsc,
        statusValidacao: meta.statusValidacao,
        responsavel: meta.responsavelUser,
        projetos: meta.iniciativas.length,
        pctExecucao: totalTarefas ? Math.round((concluidas / totalTarefas) * 100) : 0,
        indicadores: meta.indicadores.map((ind) => ({
          id: ind.id,
          nome: ind.nome,
          unidade: ind.unidade,
          valorBase: ind.valorBase,
          alvo: ind.alvo,
          valorAtual: ind.valorAtual,
          periodicidade: ind.periodicidade,
          polaridade: ind.polaridade,
          fonte: ind.fonte,
          responsavel: ind.responsavelUser,
          ultimaMedicao: ind.medicoes[0]?.dataCorte.toISOString() ?? null,
          progresso: progressoIndicador(ind),
        })),
      };
    });
    const metasExecucao = metasExecucaoRows.map((meta) => {
      const estados = meta.marcos.map((m) =>
        m.encerradoSemSolucaoEm ? "CONCLUIDO" : prazoStatus(m, meta.iniciativa.dataReferencia ?? dataRef),
      );
      const concluidas = estados.filter((e) => e === "CONCLUIDO").length;
      return {
        id: meta.id,
        codigo: meta.codigo,
        nome: meta.nome,
        status: meta.status,
        alvo: meta.alvo,
        valorAtual: meta.valorAtual,
        unidade: meta.unidade,
        prazo: meta.prazo?.toISOString() ?? null,
        responsavel: meta.responsavelUser ?? (meta.responsavel ? { id: null, name: meta.responsavel } : null),
        participacao: meta.iniciativa.secretariaPrincipalId === focus.secretaria.id ? "PRINCIPAL" : "CORRELACIONADO",
        projeto: { id: meta.iniciativa.id, codigo: meta.iniciativa.codigo, nome: meta.iniciativa.nome },
        tarefas: {
          total: estados.length,
          concluidas,
          atrasadas: estados.filter((e) => e === "VENCIDO").length,
        },
        pctConclusao: estados.length ? Math.round((concluidas / estados.length) * 100) : 0,
        indicadores: meta.indicadores.map((ind) => ({ ...ind, progresso: progressoIndicador(ind) })),
      };
    });

    res.json({
      data: {
        metasEstrategicas,
        metasExecucao,
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
        projetosPrincipais: focus.projetosPrincipais,
        projetosCorrelacionados: focus.projetosCorrelacionados,
        projetos: focus.projetosPrincipais,
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
