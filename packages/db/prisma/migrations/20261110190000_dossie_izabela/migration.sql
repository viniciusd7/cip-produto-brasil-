-- AlterTable PlanoGoverno
ALTER TABLE `PlanoGoverno` ADD COLUMN `mandatoInicio` DATETIME(3) NULL,
    ADD COLUMN `mandatoFim` DATETIME(3) NULL;

-- AlterTable MetaEstrategica
ALTER TABLE `MetaEstrategica` ADD COLUMN `indicador` VARCHAR(191) NULL,
    ADD COLUMN `valorBase` VARCHAR(191) NULL,
    ADD COLUMN `alvo` VARCHAR(191) NULL,
    ADD COLUMN `unidade` VARCHAR(191) NULL,
    ADD COLUMN `periodicidade` VARCHAR(191) NULL,
    ADD COLUMN `prazo` DATETIME(3) NULL,
    ADD COLUMN `statusValidacao` VARCHAR(191) NOT NULL DEFAULT 'PENDENTE',
    ADD COLUMN `perspectivaBsc` VARCHAR(191) NULL,
    ADD COLUMN `resultadoChaveOkr` VARCHAR(191) NULL;

-- CreateTable Medicao
CREATE TABLE `Medicao` (
    `id` VARCHAR(191) NOT NULL,
    `municipioId` VARCHAR(191) NOT NULL,
    `metaEstrategicaId` VARCHAR(191) NULL,
    `metaExecucaoId` VARCHAR(191) NULL,
    `dataCorte` DATETIME(3) NOT NULL,
    `valorRealizado` VARCHAR(191) NOT NULL,
    `valorEsperado` VARCHAR(191) NULL,
    `fonte` VARCHAR(191) NULL,
    `confiabilidade` VARCHAR(191) NULL DEFAULT 'MEDIA',
    `observacao` TEXT NULL,
    `autorId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable DependenciaVinculo
CREATE TABLE `DependenciaVinculo` (
    `id` VARCHAR(191) NOT NULL,
    `municipioId` VARCHAR(191) NOT NULL,
    `origemTipo` VARCHAR(191) NOT NULL,
    `origemId` VARCHAR(191) NOT NULL,
    `destinoTipo` VARCHAR(191) NOT NULL,
    `destinoId` VARCHAR(191) NOT NULL,
    `tipo` VARCHAR(191) NOT NULL DEFAULT 'IMPEDITIVA',
    `sentido` VARCHAR(191) NOT NULL DEFAULT 'ORIGEM_BLOQUEIA_DESTINO',
    `justificativa` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDENTE',
    `autorId` VARCHAR(191) NULL,
    `validadorId` VARCHAR(191) NULL,
    `validadoEm` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable DocumentoConhecimento
CREATE TABLE `DocumentoConhecimento` (
    `id` VARCHAR(191) NOT NULL,
    `municipioId` VARCHAR(191) NOT NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `vigencia` VARCHAR(191) NULL,
    `versao` VARCHAR(191) NULL,
    `fonte` VARCHAR(191) NULL,
    `responsavel` VARCHAR(191) NULL,
    `statusConferencia` VARCHAR(191) NOT NULL DEFAULT 'PENDENTE',
    `arquivoUrl` VARCHAR(191) NULL,
    `observacao` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable IniciativaDocumento
CREATE TABLE `IniciativaDocumento` (
    `id` VARCHAR(191) NOT NULL,
    `iniciativaId` VARCHAR(191) NOT NULL,
    `documentoId` VARCHAR(191) NOT NULL,
    `papel` VARCHAR(191) NOT NULL DEFAULT 'REFERENCIA',
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable SugestaoIA
CREATE TABLE `SugestaoIA` (
    `id` VARCHAR(191) NOT NULL,
    `municipioId` VARCHAR(191) NOT NULL,
    `entidadeTipo` VARCHAR(191) NOT NULL,
    `entidadeId` VARCHAR(191) NULL,
    `campo` VARCHAR(191) NULL,
    `sugestao` TEXT NOT NULL,
    `fonte` VARCHAR(191) NULL,
    `confianca` VARCHAR(191) NOT NULL DEFAULT 'BAIXA',
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDENTE',
    `autorId` VARCHAR(191) NULL,
    `decidedById` VARCHAR(191) NULL,
    `decidedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable SolicitacaoValidacao
CREATE TABLE `SolicitacaoValidacao` (
    `id` VARCHAR(191) NOT NULL,
    `municipioId` VARCHAR(191) NOT NULL,
    `entidadeTipo` VARCHAR(191) NOT NULL,
    `entidadeId` VARCHAR(191) NOT NULL,
    `tipo` VARCHAR(191) NOT NULL DEFAULT 'REVISAO',
    `justificativa` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ABERTA',
    `autorId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable DecisaoValidacao
CREATE TABLE `DecisaoValidacao` (
    `id` VARCHAR(191) NOT NULL,
    `solicitacaoId` VARCHAR(191) NOT NULL,
    `resultado` VARCHAR(191) NOT NULL,
    `parecer` TEXT NOT NULL,
    `validadorId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Indexes / FKs
CREATE INDEX `Medicao_municipioId_idx` ON `Medicao`(`municipioId`);
CREATE INDEX `Medicao_metaEstrategicaId_dataCorte_idx` ON `Medicao`(`metaEstrategicaId`, `dataCorte`);
CREATE INDEX `Medicao_metaExecucaoId_dataCorte_idx` ON `Medicao`(`metaExecucaoId`, `dataCorte`);

CREATE INDEX `DependenciaVinculo_municipioId_idx` ON `DependenciaVinculo`(`municipioId`);
CREATE INDEX `DependenciaVinculo_origemTipo_origemId_idx` ON `DependenciaVinculo`(`origemTipo`, `origemId`);
CREATE INDEX `DependenciaVinculo_destinoTipo_destinoId_idx` ON `DependenciaVinculo`(`destinoTipo`, `destinoId`);
CREATE INDEX `DependenciaVinculo_status_idx` ON `DependenciaVinculo`(`status`);

CREATE INDEX `DocumentoConhecimento_municipioId_tipo_idx` ON `DocumentoConhecimento`(`municipioId`, `tipo`);
CREATE INDEX `DocumentoConhecimento_statusConferencia_idx` ON `DocumentoConhecimento`(`statusConferencia`);

CREATE UNIQUE INDEX `IniciativaDocumento_iniciativaId_documentoId_key` ON `IniciativaDocumento`(`iniciativaId`, `documentoId`);

CREATE INDEX `SugestaoIA_municipioId_status_idx` ON `SugestaoIA`(`municipioId`, `status`);
CREATE INDEX `SugestaoIA_entidadeTipo_entidadeId_idx` ON `SugestaoIA`(`entidadeTipo`, `entidadeId`);

CREATE INDEX `SolicitacaoValidacao_municipioId_status_idx` ON `SolicitacaoValidacao`(`municipioId`, `status`);
CREATE INDEX `SolicitacaoValidacao_entidadeTipo_entidadeId_idx` ON `SolicitacaoValidacao`(`entidadeTipo`, `entidadeId`);
CREATE INDEX `DecisaoValidacao_solicitacaoId_idx` ON `DecisaoValidacao`(`solicitacaoId`);

ALTER TABLE `Medicao` ADD CONSTRAINT `Medicao_municipioId_fkey` FOREIGN KEY (`municipioId`) REFERENCES `Municipio`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Medicao` ADD CONSTRAINT `Medicao_metaEstrategicaId_fkey` FOREIGN KEY (`metaEstrategicaId`) REFERENCES `MetaEstrategica`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Medicao` ADD CONSTRAINT `Medicao_metaExecucaoId_fkey` FOREIGN KEY (`metaExecucaoId`) REFERENCES `MetaExecucao`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Medicao` ADD CONSTRAINT `Medicao_autorId_fkey` FOREIGN KEY (`autorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `DependenciaVinculo` ADD CONSTRAINT `DependenciaVinculo_municipioId_fkey` FOREIGN KEY (`municipioId`) REFERENCES `Municipio`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `DependenciaVinculo` ADD CONSTRAINT `DependenciaVinculo_autorId_fkey` FOREIGN KEY (`autorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `DependenciaVinculo` ADD CONSTRAINT `DependenciaVinculo_validadorId_fkey` FOREIGN KEY (`validadorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `DocumentoConhecimento` ADD CONSTRAINT `DocumentoConhecimento_municipioId_fkey` FOREIGN KEY (`municipioId`) REFERENCES `Municipio`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `IniciativaDocumento` ADD CONSTRAINT `IniciativaDocumento_iniciativaId_fkey` FOREIGN KEY (`iniciativaId`) REFERENCES `Iniciativa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `IniciativaDocumento` ADD CONSTRAINT `IniciativaDocumento_documentoId_fkey` FOREIGN KEY (`documentoId`) REFERENCES `DocumentoConhecimento`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `SugestaoIA` ADD CONSTRAINT `SugestaoIA_municipioId_fkey` FOREIGN KEY (`municipioId`) REFERENCES `Municipio`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `SugestaoIA` ADD CONSTRAINT `SugestaoIA_autorId_fkey` FOREIGN KEY (`autorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `SugestaoIA` ADD CONSTRAINT `SugestaoIA_decidedById_fkey` FOREIGN KEY (`decidedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `SolicitacaoValidacao` ADD CONSTRAINT `SolicitacaoValidacao_municipioId_fkey` FOREIGN KEY (`municipioId`) REFERENCES `Municipio`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `SolicitacaoValidacao` ADD CONSTRAINT `SolicitacaoValidacao_autorId_fkey` FOREIGN KEY (`autorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `DecisaoValidacao` ADD CONSTRAINT `DecisaoValidacao_solicitacaoId_fkey` FOREIGN KEY (`solicitacaoId`) REFERENCES `SolicitacaoValidacao`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `DecisaoValidacao` ADD CONSTRAINT `DecisaoValidacao_validadorId_fkey` FOREIGN KEY (`validadorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
