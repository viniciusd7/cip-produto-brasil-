CREATE TABLE "IniciativaCarretasDossie" (
    "id" TEXT NOT NULL,
    "iniciativaId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "dossie" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IniciativaCarretasDossie_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "IniciativaCarretasDossie_dossie_object_check"
        CHECK (jsonb_typeof("dossie") = 'object')
);

CREATE UNIQUE INDEX "IniciativaCarretasDossie_iniciativaId_key"
ON "IniciativaCarretasDossie"("iniciativaId");

CREATE INDEX "IniciativaCarretasDossie_updatedAt_idx"
ON "IniciativaCarretasDossie"("updatedAt");

ALTER TABLE "IniciativaCarretasDossie" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "IniciativaCarretasDossie"
ADD CONSTRAINT "IniciativaCarretasDossie_iniciativaId_fkey"
FOREIGN KEY ("iniciativaId") REFERENCES "Iniciativa"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
