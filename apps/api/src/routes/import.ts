import { Router } from "express";
import { z } from "zod";
import { prisma } from "@cip/db";
import { requireAuth, requirePermission } from "../middleware/auth";
import { writeAudit } from "../services/audit";

export const importRouter = Router();

importRouter.use(requireAuth, requirePermission("import:run"));

const rowSchema = z.object({
  idExterno: z.string(),
  secretaria: z.string(),
  projeto: z.string(),
  tarefa: z.string(),
  responsavel: z.string().optional(),
  prazoOriginal: z.string().nullable().optional(),
  novoPrazo: z.string().nullable().optional(),
  justificativaReprog: z.string().optional(),
  conclusao: z.string().nullable().optional(),
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

    const snapshot = await prisma.importacaoSnapshot.create({
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
      const secretaria = await prisma.secretaria.findFirst({
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
        await prisma.importacaoConflito.create({
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
      const existing = await prisma.iniciativa.findUnique({
        where: {
          municipioId_codigo: { municipioId, codigo },
        },
      });

      if (existing) {
        // AT-09: não sobrescrever automaticamente
        conflitos += 1;
        await prisma.importacaoConflito.create({
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

      const iniciativa = await prisma.iniciativa.create({
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

      const marco = await prisma.marcoEntrega.create({
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

      if (linha.novoPrazo && linha.prazoOriginal && linha.justificativaReprog) {
        await prisma.reprogramacao.create({
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
        await prisma.impedimento.create({
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

    const updated = await prisma.importacaoSnapshot.update({
      where: { id: snapshot.id },
      data: {
        importadas,
        conflitos,
        resultado: conflitos > 0 ? "CONCLUIDO_COM_CONFLITOS" : "CONCLUIDO",
        log: logs.join("\n"),
      },
      include: { itensConflito: true },
    });

    await writeAudit({
      user: req.user,
      action: "IMPORT_AMOSTRAL",
      entity: "ImportacaoSnapshot",
      entityId: snapshot.id,
      after: { importadas, conflitos },
      ip: req.ip,
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
