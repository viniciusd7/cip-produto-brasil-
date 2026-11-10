import { Router } from "express";
import { z } from "zod";
import { prisma } from "@cip/db";
import {
  evaluateWizard,
  formatarDetalhes,
  MODELO_ACAO_DIARIA,
  MODELO_PLANO_GOVERNO,
  parseCondicaoResposta,
  type ModeloSnapshot,
  type RespostaViabilidade,
  type TreeNode,
} from "@cip/shared";
import {
  assertMunicipioAccess,
  requireAuth,
  requirePermission,
} from "../middleware/auth";
import { HttpError } from "../middleware/error";
import { writeAudit } from "../services/audit";
import { notifications } from "../services/notifications";
import { promoteToTitular } from "../services/secretaria-pessoas";
import {
  loadModeloSnapshot,
  persistTree,
} from "../services/wizard-persist";

export const wizardRouter = Router();
wizardRouter.use(requireAuth);

function modeloVazio(): ModeloSnapshot {
  return { codigo: "VAZIO", nome: "Sem modelo", perguntas: [], estrutura: [] };
}

const valorRespostaSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.record(z.string(), z.unknown()),
]);

/** Escopo do projeto: Meta → Tarefa → Subtarefa, cada item com responsável. */
const treeNodeSchema: z.ZodType<TreeNode> = z.lazy(() =>
  z.object({
    codigo: z.string().min(1).max(120),
    nivel: z.enum(["META", "TAREFA", "SUBTAREFA"]),
    nome: z.string().min(2).max(500),
    indicador: z.string().max(300).nullable().optional(),
    alvo: z.string().max(300).nullable().optional(),
    responsavel: z.string().max(200).nullable().optional(),
    prazo: z
      .string()
      .refine((v) => !Number.isNaN(Date.parse(v)), "Prazo inválido")
      .nullable()
      .optional(),
    origemPerguntaCodigo: z.string().nullable().optional(),
    origemValor: z.string().nullable().optional(),
    children: z.array(treeNodeSchema),
  }),
);

const previewSchema = z.object({
  modeloProjetoId: z.string().optional(),
  classificacaoPrincipal: z.enum([
    "ESTRUTURANTE",
    "PLANO_GOVERNO",
    "ACAO_DIARIA",
  ]),
  respostas: z
    .array(
      z.object({
        perguntaCodigo: z.string(),
        valor: valorRespostaSchema,
      }),
    )
    .default([]),
  estruturaOverride: z.array(treeNodeSchema).optional(),
});

function mapAplicabilidade(a: string) {
  if (a === "sim") return "SIM";
  if (a === "nao") return "NAO";
  return "A_AVALIAR";
}

function mapSituacao(s: string) {
  if (s === "atendida") return "ATENDIDA";
  if (s === "pendente") return "PENDENTE";
  if (s === "dispensada_com_fundamento") return "DISPENSADA_COM_FUNDAMENTO";
  if (s === "em_analise") return "EM_ANALISE";
  return "NAO_INICIADA";
}

async function persistVerificacoesFromRespostas(
  // Prisma interactive transaction client
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  iniciativaId: string,
  modeloSnap: ModeloSnapshot,
  respostas: Array<{ perguntaCodigo: string; valor: unknown }>,
) {
  for (const r of respostas) {
    const pergunta = modeloSnap.perguntas.find((p) => p.codigo === r.perguntaCodigo);
    if (!pergunta) continue;
    if (
      pergunta.tipoResposta !== "CONDICAO_FECHADA" &&
      pergunta.tipoResposta !== "SIM_NAO" &&
      pergunta.tipoResposta !== "SIM_NAO_ANDAMENTO"
    ) {
      continue;
    }
    const parsed = parseCondicaoResposta(r.perguntaCodigo, r.valor);
    const tipo = await tx.tipoVerificacao.upsert({
      where: { codigo: r.perguntaCodigo },
      update: {
        nome: pergunta.rotulo || pergunta.texto,
        descricao: pergunta.ajuda || null,
        active: true,
      },
      create: {
        codigo: r.perguntaCodigo,
        nome: pergunta.rotulo || pergunta.texto,
        descricao: pergunta.ajuda || null,
        active: true,
      },
    });
    await tx.verificacao.upsert({
      where: {
        iniciativaId_tipoVerificacaoId: {
          iniciativaId,
          tipoVerificacaoId: tipo.id,
        },
      },
      update: {
        aplicabilidade: mapAplicabilidade(parsed.aplicabilidade),
        situacao: mapSituacao(parsed.situacao),
        justificativa:
          [
            parsed.fundamento,
            formatarDetalhes(
              parsed.detalhes,
              Object.fromEntries(
                (pergunta.camposFollowUp || []).map((c) => [c.chave, c.label]),
              ),
            ),
          ]
            .filter(Boolean)
            .join(" · ") || null,
        proximaAcao: parsed.proximoPasso || null,
        responsavel: parsed.responsavel || null,
        efeitoNoAvanco:
          parsed.aplicabilidade === "nao" || parsed.situacao === "atendida"
            ? "INFORMATIVO"
            : "REQUER_PROVIDENCIA",
      },
      create: {
        iniciativaId,
        tipoVerificacaoId: tipo.id,
        aplicabilidade: mapAplicabilidade(parsed.aplicabilidade),
        situacao: mapSituacao(parsed.situacao),
        justificativa:
          [
            parsed.fundamento,
            formatarDetalhes(
              parsed.detalhes,
              Object.fromEntries(
                (pergunta.camposFollowUp || []).map((c) => [c.chave, c.label]),
              ),
            ),
          ]
            .filter(Boolean)
            .join(" · ") || null,
        proximaAcao: parsed.proximoPasso || null,
        responsavel: parsed.responsavel || null,
        efeitoNoAvanco:
          parsed.aplicabilidade === "nao" || parsed.situacao === "atendida"
            ? "INFORMATIVO"
            : "REQUER_PROVIDENCIA",
      },
    });
  }
}

wizardRouter.post(
  "/preview",
  requirePermission("iniciativa:write"),
  async (req, res, next) => {
    try {
      const body = previewSchema.parse(req.body);
      let modelo: ModeloSnapshot = modeloVazio();

      if (body.classificacaoPrincipal === "ACAO_DIARIA") {
        modelo = MODELO_ACAO_DIARIA;
      } else if (body.classificacaoPrincipal === "PLANO_GOVERNO") {
        modelo = MODELO_PLANO_GOVERNO;
      } else if (body.modeloProjetoId) {
        const row = await prisma.modeloProjeto.findUnique({
          where: { id: body.modeloProjetoId },
        });
        if (!row) throw new HttpError(404, "NOT_FOUND", "Modelo não encontrado");
        await assertMunicipioAccess(req.user!, row.municipioId, "Modelo");
        modelo = await loadModeloSnapshot(row.id);
      }

      const result = evaluateWizard({
        modelo,
        classificacaoPrincipal: body.classificacaoPrincipal,
        respostas: body.respostas,
      });

      res.json({
        data: {
          ...result,
          estrutura: body.estruturaOverride || result.estrutura,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

const novaPessoaSchema = z.object({
  nome: z.string().min(2),
  cargo: z.string().min(2),
  telefone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal("")),
  papel: z.enum(["TITULAR", "EQUIPE"]).optional(),
});

const confirmSchema = previewSchema.extend({
  codigo: z.string().min(2),
  nome: z.string().min(3),
  descricao: z.string().optional(),
  secretariaPrincipalId: z.string(),
  secretariaIds: z.array(z.string()).optional(),
  metaEstrategicaId: z.string().optional(),
  novaMeta: z.object({ nome: z.string().trim().min(3), planoId: z.string().min(1).optional(), novoPlanoNome: z.string().trim().min(3).optional() }).refine((v) => Boolean(v.planoId) !== Boolean(v.novoPlanoNome), "Escolha um plano ou informe o nome do novo plano").optional(),
  vinculoPlanoGoverno: z.boolean().optional(),
  responsavel: z.string().optional(),
  responsavelPessoaId: z.string().optional(),
  novaPessoa: novaPessoaSchema.optional(),
});

wizardRouter.post(
  "/confirmar",
  requirePermission("iniciativa:write"),
  async (req, res, next) => {
    try {
      const body = confirmSchema.parse(req.body);
      const municipioId = req.user!.municipioId;

      const secretaria = await prisma.secretaria.findFirst({
        where: { id: body.secretariaPrincipalId, municipioId },
      });
      if (!secretaria) {
        throw new HttpError(422, "INVALID_SECRETARIA", "Secretaria inválida");
      }

      // Mesmas garantias de POST /iniciativas: referências do mesmo município.
      const correlatasIds = [...new Set(body.secretariaIds || [])].filter(
        (id) => id !== body.secretariaPrincipalId,
      );
      if (correlatasIds.length) {
        const encontradas = await prisma.secretaria.findMany({
          where: { id: { in: correlatasIds }, municipioId, active: true },
          select: { id: true },
        });
        if (encontradas.length !== correlatasIds.length) {
          throw new HttpError(
            422,
            "INVALID_SECRETARIAS",
            "Uma ou mais secretarias correlacionadas não pertencem a este município",
          );
        }
      }
      if (body.novaMeta && body.metaEstrategicaId) throw new HttpError(422, "INVALID_META", "Escolha uma meta existente ou crie uma nova");
      if (body.novaMeta?.planoId && !await prisma.planoGoverno.findFirst({ where: { id: body.novaMeta.planoId, municipioId } })) throw new HttpError(422, "INVALID_PLANO", "Plano inválido para este município");
      if (body.metaEstrategicaId) {
        const meta = await prisma.metaEstrategica.findFirst({
          where: { id: body.metaEstrategicaId, plano: { municipioId } },
          select: { id: true },
        });
        if (!meta) {
          throw new HttpError(
            422,
            "INVALID_META",
            "A meta estratégica não pertence ao plano de governo deste município",
          );
        }
      }

      if (!body.responsavelPessoaId && !body.novaPessoa) {
        throw new HttpError(
          422,
          "RESPONSAVEL_REQUIRED",
          "Selecione ou cadastre o responsável",
        );
      }

      const vinculaPlano =
        body.classificacaoPrincipal === "PLANO_GOVERNO" ||
        Boolean(body.vinculoPlanoGoverno || body.novaMeta || body.metaEstrategicaId);

      if (vinculaPlano && !body.metaEstrategicaId && !body.novaMeta) {
        throw new HttpError(
          422,
          "META_REQUIRED",
          "Plano de Governo exige meta estratégica",
        );
      }

      let modeloSnap: ModeloSnapshot = modeloVazio();
      let modeloId: string | undefined;

      if (body.classificacaoPrincipal === "ACAO_DIARIA") {
        modeloSnap = MODELO_ACAO_DIARIA;
      } else if (body.classificacaoPrincipal === "PLANO_GOVERNO") {
        modeloSnap = MODELO_PLANO_GOVERNO;
      } else if (body.modeloProjetoId) {
        const row = await prisma.modeloProjeto.findUnique({
          where: { id: body.modeloProjetoId },
        });
        if (!row) throw new HttpError(404, "NOT_FOUND", "Modelo não encontrado");
        await assertMunicipioAccess(req.user!, row.municipioId, "Modelo");
        modeloId = row.id;
        modeloSnap = await loadModeloSnapshot(row.id);
      }

      const evaluated = evaluateWizard({
        modelo: modeloSnap,
        classificacaoPrincipal: body.classificacaoPrincipal,
        respostas: body.respostas,
      });
      const estrutura =
        (body.estruturaOverride as TreeNode[] | undefined) || evaluated.estrutura;

      const created = await prisma.$transaction(async (tx) => {
        let metaEstrategicaId = body.metaEstrategicaId;
        if (body.novaMeta) {
          const planoId = body.novaMeta.planoId || (await tx.planoGoverno.create({ data: { municipioId, nome: body.novaMeta.novoPlanoNome! } })).id;
          metaEstrategicaId = (await tx.metaEstrategica.create({ data: { planoId, secretariaId: secretaria.id, nome: body.novaMeta.nome } })).id;
        }
        let responsavelPessoaId = body.responsavelPessoaId || null;
        let responsavelNome = body.responsavel || secretaria.titularNome || null;

        if (body.novaPessoa) {
          const email =
            body.novaPessoa.email === undefined || body.novaPessoa.email === ""
              ? null
              : body.novaPessoa.email;
          const papel = body.novaPessoa.papel || "EQUIPE";
          let pessoa = await tx.secretariaPessoa.create({
            data: {
              secretariaId: secretaria.id,
              nome: body.novaPessoa.nome.trim(),
              cargo: body.novaPessoa.cargo.trim(),
              telefone: body.novaPessoa.telefone?.trim() || null,
              email,
              papel: papel === "TITULAR" ? "EQUIPE" : papel,
              ativo: true,
            },
          });
          if (papel === "TITULAR") {
            pessoa = await promoteToTitular(tx, secretaria.id, pessoa.id);
          }
          responsavelPessoaId = pessoa.id;
          responsavelNome = pessoa.nome;
        } else if (responsavelPessoaId) {
          // Responsável pode ser de qualquer secretaria envolvida no projeto.
          const pessoa = await tx.secretariaPessoa.findFirst({
            where: {
              id: responsavelPessoaId,
              secretariaId: { in: [secretaria.id, ...correlatasIds] },
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
          responsavelNome = pessoa.nome;
        }

        const ini = await tx.iniciativa.create({
          data: {
            municipioId,
            secretariaPrincipalId: body.secretariaPrincipalId,
            metaEstrategicaId: metaEstrategicaId || null,
            codigo: body.codigo,
            nome: body.nome,
            descricao: body.descricao,
            responsavel: responsavelNome,
            responsavelPessoaId,
            ciclo: evaluated.cicloInicial,
            estruturante: body.classificacaoPrincipal === "ESTRUTURANTE",
            classificacaoPrincipal: body.classificacaoPrincipal,
            vinculoPlanoGoverno: vinculaPlano,
            modeloProjetoId: modeloId,
            modeloSnapshot: modeloSnap as object,
            bloqueioLabel: evaluated.bloqueioLabel,
            bloqueiosAtivos: evaluated.bloqueios,
            prioridadeNivel: evaluated.prioridade,
            etapaAtual: evaluated.etapaAtual,
            prontidaoPct: evaluated.prontidaoPct,
            criadoPorId: req.user!.id,
            fonte: "wizard",
            dataReferencia: new Date(),
          },
        });

        for (const sid of correlatasIds) {
          await tx.iniciativaSecretaria.create({
            data: {
              iniciativaId: ini.id,
              secretariaId: sid,
              papel: "CORRESPONSAVEL",
            },
          });
        }

        for (const r of body.respostas) {
          const pergunta = modeloSnap.perguntas.find(
            (p) => p.codigo === r.perguntaCodigo,
          );
          if (!pergunta) continue;
          await tx.iniciativaRespostaViabilidade.create({
            data: {
              iniciativaId: ini.id,
              perguntaCodigo: r.perguntaCodigo,
              perguntaTexto: pergunta.texto,
              valor: r.valor as unknown as object,
              impacto: pergunta.impacto,
              autorId: req.user!.id,
            },
          });
        }

        await persistVerificacoesFromRespostas(
          tx,
          ini.id,
          modeloSnap,
          body.respostas,
        );

        await persistTree(ini.id, estrutura, tx);
        return ini;
      });

      if (evaluated.bloqueioLabel) {
        await notifications.notifyResponsavelBloqueio({
          iniciativaId: created.id,
          codigo: created.codigo,
          nome: created.nome,
          responsavel: created.responsavel,
          bloqueioLabel: evaluated.bloqueioLabel,
          secretariaNome: secretaria.nome,
          titularTelefone: secretaria.titularTelefone,
          titularEmail: secretaria.titularEmail,
        });
      }

      await writeAudit({
        user: req.user,
        action: "CREATE",
        entity: "Iniciativa",
        entityId: created.id,
        after: {
          id: created.id,
          ciclo: created.ciclo,
          bloqueioLabel: created.bloqueioLabel,
          prioridadeNivel: created.prioridadeNivel,
          etapaAtual: created.etapaAtual,
        },
        ip: req.ip,
      });

      res.status(201).json({
        data: {
          id: created.id,
          ciclo: created.ciclo,
          bloqueioLabel: created.bloqueioLabel,
          bloqueios: evaluated.bloqueios,
          prioridade: evaluated.prioridade,
          motivosPrioridade: evaluated.motivosPrioridade,
          etapaAtual: evaluated.etapaAtual,
          prontidaoPct: evaluated.prontidaoPct,
          etapas: evaluated.etapas,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

const reavaliarSchema = z.object({
  respostas: z.array(
    z.object({
      perguntaCodigo: z.string(),
      valor: valorRespostaSchema,
    }),
  ),
});

wizardRouter.patch(
  "/:id/viabilidade",
  requirePermission("iniciativa:write"),
  async (req, res, next) => {
    try {
      const ini = await prisma.iniciativa.findUnique({
        where: { id: req.params.id },
        include: {
          secretariaPrincipal: true,
          respostasViabilidade: true,
        },
      });
      if (!ini) throw new HttpError(404, "NOT_FOUND", "Iniciativa não encontrada");
      await assertMunicipioAccess(req.user!, ini.municipioId, "Iniciativa");

      const body = reavaliarSchema.parse(req.body);
      const modeloSnap = (ini.modeloSnapshot as ModeloSnapshot) || modeloVazio();

      // Avalia o conjunto completo: respostas já salvas, substituídas pelas enviadas agora.
      // Antes só as enviadas eram avaliadas, e o resultado ignorava o restante do checklist.
      const respostasCompletas = new Map<string, RespostaViabilidade["valor"]>();
      for (const r of ini.respostasViabilidade) {
        respostasCompletas.set(
          r.perguntaCodigo,
          r.valor as unknown as RespostaViabilidade["valor"],
        );
      }
      for (const r of body.respostas) respostasCompletas.set(r.perguntaCodigo, r.valor);
      const todasRespostas: RespostaViabilidade[] = [...respostasCompletas].map(
        ([perguntaCodigo, valor]) => ({ perguntaCodigo, valor }),
      );

      const evaluated = evaluateWizard({
        modelo: modeloSnap,
        classificacaoPrincipal:
          (ini.classificacaoPrincipal as
            | "ESTRUTURANTE"
            | "PLANO_GOVERNO"
            | "ACAO_DIARIA") ||
          (ini.estruturante ? "ESTRUTURANTE" : "ACAO_DIARIA"),
        respostas: todasRespostas,
      });

      const wasBlocked = ini.ciclo === "AGUARDANDO_PRE_REQUISITO";

      await prisma.$transaction(async (tx) => {
        for (const r of body.respostas) {
          const pergunta = modeloSnap.perguntas.find(
            (p) => p.codigo === r.perguntaCodigo,
          );
          if (!pergunta) continue;
          const existing = ini.respostasViabilidade.find(
            (x) => x.perguntaCodigo === r.perguntaCodigo,
          );
          if (existing) {
            await tx.iniciativaRespostaHistorico.create({
              data: {
                respostaId: existing.id,
                valorAnterior: existing.valor as object,
                valorNovo: r.valor as unknown as object,
                autorId: req.user!.id,
              },
            });
            await tx.iniciativaRespostaViabilidade.update({
              where: { id: existing.id },
              data: { valor: r.valor as unknown as object, autorId: req.user!.id },
            });
          } else {
            await tx.iniciativaRespostaViabilidade.create({
              data: {
                iniciativaId: ini.id,
                perguntaCodigo: r.perguntaCodigo,
                perguntaTexto: pergunta.texto,
                valor: r.valor as unknown as object,
                impacto: pergunta.impacto,
                autorId: req.user!.id,
              },
            });
          }
        }

        await tx.iniciativa.update({
          where: { id: ini.id },
          data: {
            ciclo: evaluated.cicloInicial,
            bloqueioLabel: evaluated.bloqueioLabel,
            bloqueiosAtivos: evaluated.bloqueios,
            prioridadeNivel: evaluated.prioridade,
            etapaAtual: evaluated.etapaAtual,
            prontidaoPct: evaluated.prontidaoPct,
            atualizadoEm: new Date(),
          },
        });
      });

      if (wasBlocked && !evaluated.bloqueioLabel) {
        await notifications.notifyBloqueioResolvido({
          iniciativaId: ini.id,
          codigo: ini.codigo,
          nome: ini.nome,
          responsavel: ini.responsavel,
          bloqueioLabel: "Pré-requisito resolvido",
          secretariaNome: ini.secretariaPrincipal.nome,
        });
      } else if (evaluated.bloqueioLabel) {
        await notifications.notifyResponsavelBloqueio({
          iniciativaId: ini.id,
          codigo: ini.codigo,
          nome: ini.nome,
          responsavel: ini.responsavel,
          bloqueioLabel: evaluated.bloqueioLabel,
          secretariaNome: ini.secretariaPrincipal.nome,
        });
      }

      res.json({
        data: {
          ciclo: evaluated.cicloInicial,
          bloqueioLabel: evaluated.bloqueioLabel,
          bloqueios: evaluated.bloqueios,
          prioridade: evaluated.prioridade,
          motivosPrioridade: evaluated.motivosPrioridade,
          etapaAtual: evaluated.etapaAtual,
          prontidaoPct: evaluated.prontidaoPct,
          etapas: evaluated.etapas,
          avisos: evaluated.avisos,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);
