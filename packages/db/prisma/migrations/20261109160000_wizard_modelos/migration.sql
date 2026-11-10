-- AlterTable Iniciativa
ALTER TABLE `Iniciativa`
  ADD COLUMN `classificacaoPrincipal` VARCHAR(191) NULL,
  ADD COLUMN `vinculoPlanoGoverno` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `modeloProjetoId` VARCHAR(191) NULL,
  ADD COLUMN `modeloSnapshot` JSON NULL,
  ADD COLUMN `bloqueioLabel` VARCHAR(191) NULL,
  ADD COLUMN `bloqueiosAtivos` JSON NULL;

-- CreateTable
CREATE TABLE `ModeloProjetoCatalogo` (
    `id` VARCHAR(191) NOT NULL,
    `codigo` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `descricao` TEXT NULL,
    `categoria` VARCHAR(191) NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `versao` INTEGER NOT NULL DEFAULT 1,
    `snapshot` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ModeloProjetoCatalogo_codigo_key`(`codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ModeloProjeto` (
    `id` VARCHAR(191) NOT NULL,
    `municipioId` VARCHAR(191) NOT NULL,
    `catalogoOrigemId` VARCHAR(191) NULL,
    `codigo` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `descricao` TEXT NULL,
    `classificacoesPermitidas` JSON NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `snapshotVersion` INTEGER NOT NULL DEFAULT 1,
    `snapshot` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ModeloProjeto_municipioId_idx`(`municipioId`),
    UNIQUE INDEX `ModeloProjeto_municipioId_codigo_key`(`municipioId`, `codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ModeloPergunta` (
    `id` VARCHAR(191) NOT NULL,
    `modeloId` VARCHAR(191) NOT NULL,
    `codigo` VARCHAR(191) NOT NULL,
    `texto` TEXT NOT NULL,
    `tipoResposta` VARCHAR(191) NOT NULL,
    `impacto` VARCHAR(191) NOT NULL,
    `obrigatoria` BOOLEAN NOT NULL DEFAULT false,
    `ordem` INTEGER NOT NULL DEFAULT 0,
    `dependeDePerguntaId` VARCHAR(191) NULL,
    `dependeDeValor` JSON NULL,
    `opcoes` JSON NULL,
    `efeitos` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ModeloPergunta_modeloId_idx`(`modeloId`),
    UNIQUE INDEX `ModeloPergunta_modeloId_codigo_key`(`modeloId`, `codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ModeloEstruturaItem` (
    `id` VARCHAR(191) NOT NULL,
    `modeloId` VARCHAR(191) NOT NULL,
    `codigo` VARCHAR(191) NOT NULL,
    `nivel` VARCHAR(191) NOT NULL,
    `parentCodigo` VARCHAR(191) NULL,
    `nome` VARCHAR(191) NOT NULL,
    `indicador` VARCHAR(191) NULL,
    `alvo` VARCHAR(191) NULL,
    `ordem` INTEGER NOT NULL DEFAULT 0,
    `sempreIncluir` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ModeloEstruturaItem_modeloId_idx`(`modeloId`),
    UNIQUE INDEX `ModeloEstruturaItem_modeloId_codigo_key`(`modeloId`, `codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `IniciativaRespostaViabilidade` (
    `id` VARCHAR(191) NOT NULL,
    `iniciativaId` VARCHAR(191) NOT NULL,
    `perguntaCodigo` VARCHAR(191) NOT NULL,
    `perguntaTexto` TEXT NOT NULL,
    `valor` JSON NOT NULL,
    `impacto` VARCHAR(191) NOT NULL,
    `autorId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `IniciativaRespostaViabilidade_iniciativaId_idx`(`iniciativaId`),
    UNIQUE INDEX `IniciativaRespostaViabilidade_iniciativaId_perguntaCodigo_key`(`iniciativaId`, `perguntaCodigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `IniciativaRespostaHistorico` (
    `id` VARCHAR(191) NOT NULL,
    `respostaId` VARCHAR(191) NOT NULL,
    `valorAnterior` JSON NULL,
    `valorNovo` JSON NOT NULL,
    `autorId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `IniciativaRespostaHistorico_respostaId_idx`(`respostaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ItemGeradoOrigem` (
    `id` VARCHAR(191) NOT NULL,
    `iniciativaId` VARCHAR(191) NOT NULL,
    `metaExecucaoId` VARCHAR(191) NULL,
    `marcoId` VARCHAR(191) NULL,
    `subtarefaId` VARCHAR(191) NULL,
    `perguntaCodigo` VARCHAR(191) NULL,
    `valorQueGerou` VARCHAR(191) NULL,
    `modeloEstruturaCodigo` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ItemGeradoOrigem_iniciativaId_idx`(`iniciativaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ForeignKeys
ALTER TABLE `Iniciativa` ADD INDEX `Iniciativa_modeloProjetoId_idx`(`modeloProjetoId`);

ALTER TABLE `ModeloProjeto` ADD CONSTRAINT `ModeloProjeto_municipioId_fkey` FOREIGN KEY (`municipioId`) REFERENCES `Municipio`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ModeloProjeto` ADD CONSTRAINT `ModeloProjeto_catalogoOrigemId_fkey` FOREIGN KEY (`catalogoOrigemId`) REFERENCES `ModeloProjetoCatalogo`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ModeloPergunta` ADD CONSTRAINT `ModeloPergunta_modeloId_fkey` FOREIGN KEY (`modeloId`) REFERENCES `ModeloProjeto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ModeloPergunta` ADD CONSTRAINT `ModeloPergunta_dependeDePerguntaId_fkey` FOREIGN KEY (`dependeDePerguntaId`) REFERENCES `ModeloPergunta`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ModeloEstruturaItem` ADD CONSTRAINT `ModeloEstruturaItem_modeloId_fkey` FOREIGN KEY (`modeloId`) REFERENCES `ModeloProjeto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Iniciativa` ADD CONSTRAINT `Iniciativa_modeloProjetoId_fkey` FOREIGN KEY (`modeloProjetoId`) REFERENCES `ModeloProjeto`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `IniciativaRespostaViabilidade` ADD CONSTRAINT `IniciativaRespostaViabilidade_iniciativaId_fkey` FOREIGN KEY (`iniciativaId`) REFERENCES `Iniciativa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `IniciativaRespostaHistorico` ADD CONSTRAINT `IniciativaRespostaHistorico_respostaId_fkey` FOREIGN KEY (`respostaId`) REFERENCES `IniciativaRespostaViabilidade`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ItemGeradoOrigem` ADD CONSTRAINT `ItemGeradoOrigem_iniciativaId_fkey` FOREIGN KEY (`iniciativaId`) REFERENCES `Iniciativa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
