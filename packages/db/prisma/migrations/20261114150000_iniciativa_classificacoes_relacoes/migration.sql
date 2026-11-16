-- AlterTable
ALTER TABLE "Iniciativa" ADD COLUMN "fluxoWizard" TEXT;

-- CreateTable
CREATE TABLE "IniciativaClassificacao" (
    "id" TEXT NOT NULL,
    "iniciativaId" TEXT NOT NULL,
    "classificacao" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IniciativaClassificacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelacaoIniciativa" (
    "id" TEXT NOT NULL,
    "municipioId" TEXT NOT NULL,
    "origemIniciativaId" TEXT NOT NULL,
    "destinoIniciativaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "justificativa" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "autorId" TEXT,
    "validadorId" TEXT,
    "validadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RelacaoIniciativa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IniciativaClassificacao_classificacao_iniciativaId_idx"
ON "IniciativaClassificacao"("classificacao", "iniciativaId");

-- CreateIndex
CREATE UNIQUE INDEX "IniciativaClassificacao_iniciativaId_classificacao_key"
ON "IniciativaClassificacao"("iniciativaId", "classificacao");

-- CreateIndex
CREATE INDEX "RelacaoIniciativa_municipioId_tipo_status_idx"
ON "RelacaoIniciativa"("municipioId", "tipo", "status");

-- CreateIndex
CREATE INDEX "RelacaoIniciativa_origemIniciativaId_idx"
ON "RelacaoIniciativa"("origemIniciativaId");

-- CreateIndex
CREATE INDEX "RelacaoIniciativa_destinoIniciativaId_idx"
ON "RelacaoIniciativa"("destinoIniciativaId");

-- CreateIndex
CREATE UNIQUE INDEX "Iniciativa_municipioId_id_key"
ON "Iniciativa"("municipioId", "id");

-- These tables are in the exposed public schema. API access is through the
-- trusted Prisma backend; direct Data API roles receive no row access.
ALTER TABLE "IniciativaClassificacao" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RelacaoIniciativa" ENABLE ROW LEVEL SECURITY;

-- CreateIndex
CREATE UNIQUE INDEX "RelacaoIniciativa_origemIniciativaId_destinoIniciativaId_ti_key"
ON "RelacaoIniciativa"("origemIniciativaId", "destinoIniciativaId", "tipo");

-- AddForeignKey
ALTER TABLE "IniciativaClassificacao"
ADD CONSTRAINT "IniciativaClassificacao_iniciativaId_fkey"
FOREIGN KEY ("iniciativaId") REFERENCES "Iniciativa"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelacaoIniciativa"
ADD CONSTRAINT "RelacaoIniciativa_municipioId_origemIniciativaId_fkey"
FOREIGN KEY ("municipioId", "origemIniciativaId")
REFERENCES "Iniciativa"("municipioId", "id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelacaoIniciativa"
ADD CONSTRAINT "RelacaoIniciativa_municipioId_destinoIniciativaId_fkey"
FOREIGN KEY ("municipioId", "destinoIniciativaId")
REFERENCES "Iniciativa"("municipioId", "id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill only explicit legacy classifications; do not infer from related data.
INSERT INTO "IniciativaClassificacao" ("id", "iniciativaId", "classificacao")
SELECT
    'legacy_' || md5(i."id" || ':' || source."classificacao"),
    i."id",
    source."classificacao"
FROM "Iniciativa" AS i
CROSS JOIN LATERAL (
    VALUES
        (i."classificacaoPrincipal"),
        (CASE WHEN i."estruturante" THEN 'ESTRUTURANTE' END),
        (CASE WHEN i."vinculoPlanoGoverno" THEN 'PLANO_GOVERNO' END)
) AS source("classificacao")
WHERE source."classificacao" IN ('ESTRUTURANTE', 'PLANO_GOVERNO', 'ACAO_DIARIA')
ON CONFLICT ("iniciativaId", "classificacao") DO NOTHING;
