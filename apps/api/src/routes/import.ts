import { Router } from "express";
import { z } from "zod";
import { prisma } from "@cip/db";
import { requireAuth, requirePermission } from "../middleware/auth";

export const importRouter = Router();

importRouter.use(requireAuth, requirePermission("import:run"));

const importDateSchema = z
  .string()
  .refine(
    (value) => !Number.isNaN(Date.parse(value)),
    "Informe uma data válida",
  );

const rowSchema = z.object({
  idExterno: z.string(),
  secretaria: z.string(),
  projeto: z.string(),
  tarefa: z.string(),
  responsavel: z.string().optional(),
  prazoOriginal: importDateSchema.nullable().optional(),
  novoPrazo: importDateSchema.nullable().optional(),
  justificativaReprog: z.string().optional(),
  conclusao: importDateSchema.nullable().optional(),
  entrave: z.string().optional(),
  proximoPasso: z.string().optional(),
  origem: z.string().optional(),
});

const importSchema = z.object({
  nomeArquivo: z.string().min(1),
  dataReferencia: z.string().datetime(),
  fonte: z.string().optional(),
  linhas: z.array(rowSchema).min(1),
});

/**
 * Importação controlada (RF-13 / AT-09):
 * - cria snapshot
 * - não sobrescreve automaticamente em conflito
 * - preserva origem e data de referência
 */
importRouter.post("/amostral", async (req, res, next) => {
  try {
    const body = importSchema.parse(req.body);
    const municipioId = req.user!.municipioId;

    const updated = await prisma.$transaction(async (tx) => {
      const snapshot = await tx.importacaoSnapshot.create({
        data: {
          municipioId,
          autorId: req.user!.id,
          nomeArquivo: body.nomeArquivo,
          dataReferencia: new Date(body.dataReferencia),
          fonte: body.fonte || "IMPORTACAO_AMOSTRAL",
          totalLinhas: body.linhas.length,
          resultado: "EM_PROCESSAMENTO",
          mapaCampos: {
            id: "idExterno",
            secretaria: "secretaria",
            projeto: "projeto",
            tarefa: "tarefa",
          },
        },
      });

      let importadas = 0;
      let conflitos = 0;
      const logs: string[] = [];

      for (const linha of body.linhas) {
        const secretaria = await tx.secretaria.findFirst({
          where: {
            municipioId,
            OR: [
              { nome: { contains: linha.secretaria } },
              { sigla: linha.secretaria },
            ],
          },
        });

        if (!secretaria) {
          conflitos += 1;
          await tx.importacaoConflito.create({
            data: {
              importacaoId: snapshot.id,
              chaveExterna: linha.idExterno,
              campo: "secretaria",
              valorNovo: linha.secretaria,
            },
          });
          logs.push(`Conflito secretaria: ${linha.idExterno}`);
          continue;
        }

        const codigo = linha.idExterno.slice(0, 40);
        const existing = await tx.iniciativa.findUnique({
          where: {
            municipioId_codigo: { municipioId, codigo },
          },
        });

        if (existing) {
          // AT-09: não sobrescrever automaticamente
          conflitos += 1;
          await tx.importacaoConflito.create({
            data: {
              importacaoId: snapshot.id,
              chaveExterna: linha.idExterno,
              campo: "iniciativa",
              valorAtual: existing.nome,
              valorNovo: linha.projeto,
            },
          });
          logs.push(`Conflito ID existente (sem overwrite): ${linha.idExterno}`);
          continue;
        }

        const iniciativa = await tx.iniciativa.create({
          data: {
            municipioId,
            secretariaPrincipalId: secretaria.id,
            codigo,
            nome: linha.projeto,
            origem: linha.origem || body.fonte || "IMPORTACAO_AMOSTRAL",
            responsavel: linha.responsavel,
            ciclo: "EM_ACOMPANHAMENTO",
            fonte: body.fonte || body.nomeArquivo,
            dataReferencia: new Date(body.dataReferencia),
            confiabilidade: "MEDIA",
          },
        });

        const prazoOriginal = linha.prazoOriginal
          ? new Date(linha.prazoOriginal)
          : null;
        const prazoVigente = linha.novoPrazo
          ? new Date(linha.novoPrazo)
          : prazoOriginal;

        const marco = await tx.marcoEntrega.create({
          data: {
            iniciativaId: iniciativa.id,
            codigo: `${codigo}-T1`,
            descricao: linha.tarefa,
            responsavel: linha.responsavel,
            prazoOriginal,
            prazoVigente,
            concluidoEm: linha.conclusao ? new Date(linha.conclusao) : null,
          },
        });

        if (
          linha.novoPrazo &&
          linha.prazoOriginal &&
          linha.justificativaReprog
        ) {
          await tx.reprogramacao.create({
            data: {
              marcoId: marco.id,
              dataAnterior: prazoOriginal,
              dataNova: new Date(linha.novoPrazo),
              motivo: linha.justificativaReprog,
              autorId: req.user!.id,
            },
          });
        }

        if (linha.entrave) {
          await tx.impedimento.create({
            data: {
              iniciativaId: iniciativa.id,
              marcoId: marco.id,
              descricao: linha.entrave,
              proximoPasso: linha.proximoPasso,
              status: "ABERTO",
              responsavel: linha.responsavel,
            },
          });
        }

        importadas += 1;
        logs.push(`Importado: ${linha.idExterno}`);
      }

      const result = await tx.importacaoSnapshot.update({
        where: { id: snapshot.id },
        data: {
          importadas,
          conflitos,
          resultado: conflitos > 0 ? "CONCLUIDO_COM_CONFLITOS" : "CONCLUIDO",
          log: logs.join("\n"),
        },
        include: { itensConflito: true },
      });

      await tx.auditLog.create({
        data: {
          actorId: req.user!.id,
          municipioId,
          action: "IMPORT_AMOSTRAL",
          entity: "ImportacaoSnapshot",
          entityId: snapshot.id,
          after: { importadas, conflitos },
          ip: req.ip,
        },
      });

      return result;
    });

    res.status(201).json({ data: updated });
  } catch (err) {
    next(err);
  }
});

importRouter.get("/snapshots", async (req, res, next) => {
  try {
    const rows = await prisma.importacaoSnapshot.findMany({
      where: { municipioId: req.user!.municipioId },
      include: { itensConflito: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});
