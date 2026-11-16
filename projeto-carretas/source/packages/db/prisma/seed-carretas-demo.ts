import { PrismaClient } from "@prisma/client";
import {
  CARRETAS_ETAPAS,
  MODELO_CARRETAS_SAUDE,
  criarCarretasDossiePadrao,
} from "@cip/shared";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL precisa apontar para o PostgreSQL local de demonstração.");

const database = new URL(databaseUrl);
if (
  !["localhost", "127.0.0.1"].includes(database.hostname) ||
  database.port !== "5434"
) {
  throw new Error("Seed interrompido: ele só pode ser executado contra localhost:5434.");
}

const prisma = new PrismaClient();
const codigoIniciativa = "CARRETAS-SUS-CMD-DEMO";

function isCarretasSnapshot(value: unknown): boolean {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      "codigo" in value &&
      value.codigo === "CARRETAS_SAUDE_SUS",
  );
}

async function main() {
  const municipio = await prisma.municipio.findUnique({
    where: { ibgeCode: "3117504" },
  });
  if (!municipio || municipio.nome !== "Conceição do Mato Dentro") {
    throw new Error("Prefeitura de demonstração não encontrada; nenhum dado foi criado.");
  }

  const secretaria = await prisma.secretaria.findFirst({
    where: { municipioId: municipio.id, sigla: "SAU", active: true },
  });
  if (!secretaria) {
    throw new Error("Secretaria Municipal de Saúde ativa não encontrada; nenhum dado foi criado.");
  }

  const existing = await prisma.iniciativa.findUnique({
    where: { municipioId_codigo: { municipioId: municipio.id, codigo: codigoIniciativa } },
    select: { id: true, modeloSnapshot: true },
  });
  if (existing && !isCarretasSnapshot(existing.modeloSnapshot)) {
    throw new Error(`O código ${codigoIniciativa} já pertence a um registro que não é o template Carretas.`);
  }

  if (existing) {
    const dossier = await prisma.iniciativaCarretasDossie.findUnique({
      where: { iniciativaId: existing.id },
      select: { id: true },
    });
    if (!dossier) {
      await prisma.iniciativaCarretasDossie.create({
        data: {
          iniciativaId: existing.id,
          revision: 1,
          dossie: criarCarretasDossiePadrao(),
        },
      });
    }
    console.log(`Demonstração Carretas já existente: ${existing.id}`);
    return;
  }

  const initiative = await prisma.$transaction(async (tx) => {
    const created = await tx.iniciativa.create({
      data: {
        municipioId: municipio.id,
        secretariaPrincipalId: secretaria.id,
        codigo: codigoIniciativa,
        nome: "Carretas da Saúde SUS — planejamento e avaliação",
        descricao:
          "Modelo administrativo baseado no Projeto-Referência V2.0. Cadastro demonstrativo para validação municipal; não confirma oferta, contratação, autorização, agenda ou atendimento.",
        origem: "Projeto-Referência para Atendimento Especializado em Unidades Móveis, V2.0",
        fluxoWizard: "ESTRUTURANTE",
        ciclo: "AGUARDANDO_PRE_REQUISITO",
        publicacao: "INTERNA",
        estruturante: true,
        classificacaoPrincipal: "ESTRUTURANTE",
        bloqueioLabel: "Aguardando validação local e oferta confirmada",
        bloqueiosAtivos: [
          {
            perguntaCodigo: "CARRETAS_DOSSIE_LOCAL",
            rotulo: "Validação local, oferta, autorizações e retaguarda pendentes",
          },
        ],
        etapaAtual: "G0",
        prontidaoPct: 0,
        modeloSnapshot: MODELO_CARRETAS_SAUDE,
      },
    });

    await tx.iniciativaClassificacao.create({
      data: { iniciativaId: created.id, classificacao: "ESTRUTURANTE" },
    });

    const meta = await tx.metaExecucao.create({
      data: {
        iniciativaId: created.id,
        codigo: "META_CARRETAS_SAUDE",
        nome: "Planejamento e validação do piloto",
        indicador: "Portões, registros e prestação de contas preparados para decisão local",
        criterio: "O projeto de referência não representa oferta ou autorização municipal.",
        status: "EM_ANDAMENTO",
        ordem: 1,
      },
    });

    await tx.marcoEntrega.createMany({
      data: CARRETAS_ETAPAS.map((etapa, index) => ({
        iniciativaId: created.id,
        metaExecucaoId: meta.id,
        codigo: etapa.codigo,
        descricao: etapa.nome,
        ordem: index + 1,
      })),
    });

    await tx.iniciativaCarretasDossie.create({
      data: {
        iniciativaId: created.id,
        revision: 1,
        dossie: criarCarretasDossiePadrao(),
      },
    });

    return created;
  });

  console.log(`Demonstração Carretas criada: ${initiative.id} (${codigoIniciativa})`);
}

main()
  .catch((error: unknown) => {
    console.error("Falha ao criar o projeto demonstrativo Carretas:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
