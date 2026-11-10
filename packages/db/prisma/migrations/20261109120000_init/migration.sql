-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Role` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,

    UNIQUE INDEX `Role_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Permission` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,

    UNIQUE INDEX `Permission_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RolePermission` (
    `roleId` VARCHAR(191) NOT NULL,
    `permissionId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`roleId`, `permissionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserRole` (
    `userId` VARCHAR(191) NOT NULL,
    `roleId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`userId`, `roleId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SessionToken` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `SessionToken_token_key`(`token`),
    INDEX `SessionToken_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Municipio` (
    `id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `uf` VARCHAR(2) NOT NULL,
    `ibgeCode` VARCHAR(191) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Municipio_ibgeCode_key`(`ibgeCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VinculoUsuarioMunicipio` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `municipioId` VARCHAR(191) NOT NULL,
    `principal` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `VinculoUsuarioMunicipio_municipioId_idx`(`municipioId`),
    UNIQUE INDEX `VinculoUsuarioMunicipio_userId_municipioId_key`(`userId`, `municipioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PlanoGoverno` (
    `id` VARCHAR(191) NOT NULL,
    `municipioId` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `periodo` VARCHAR(191) NULL,
    `descricao` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PlanoGoverno_municipioId_idx`(`municipioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Secretaria` (
    `id` VARCHAR(191) NOT NULL,
    `municipioId` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `sigla` VARCHAR(191) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Secretaria_municipioId_idx`(`municipioId`),
    UNIQUE INDEX `Secretaria_municipioId_nome_key`(`municipioId`, `nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MetaEstrategica` (
    `id` VARCHAR(191) NOT NULL,
    `planoId` VARCHAR(191) NOT NULL,
    `secretariaId` VARCHAR(191) NULL,
    `codigo` VARCHAR(191) NULL,
    `nome` VARCHAR(191) NOT NULL,
    `descricao` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MetaEstrategica_planoId_idx`(`planoId`),
    INDEX `MetaEstrategica_secretariaId_idx`(`secretariaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Compromisso` (
    `id` VARCHAR(191) NOT NULL,
    `municipioId` VARCHAR(191) NOT NULL,
    `codigo` VARCHAR(191) NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `fonte` VARCHAR(191) NULL,
    `descricao` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Compromisso_municipioId_idx`(`municipioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Iniciativa` (
    `id` VARCHAR(191) NOT NULL,
    `municipioId` VARCHAR(191) NOT NULL,
    `secretariaPrincipalId` VARCHAR(191) NOT NULL,
    `metaEstrategicaId` VARCHAR(191) NULL,
    `codigo` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `descricao` TEXT NULL,
    `tipo` VARCHAR(191) NULL,
    `origem` VARCHAR(191) NULL,
    `responsavel` VARCHAR(191) NULL,
    `ciclo` VARCHAR(191) NOT NULL DEFAULT 'EM_ACOMPANHAMENTO',
    `publicacao` VARCHAR(191) NOT NULL DEFAULT 'INTERNA',
    `dataReferencia` DATETIME(3) NULL,
    `fonte` VARCHAR(191) NULL,
    `confiabilidade` VARCHAR(191) NULL DEFAULT 'MEDIA',
    `estruturante` BOOLEAN NOT NULL DEFAULT false,
    `criadoPorId` VARCHAR(191) NULL,
    `atualizadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Iniciativa_municipioId_idx`(`municipioId`),
    INDEX `Iniciativa_secretariaPrincipalId_idx`(`secretariaPrincipalId`),
    INDEX `Iniciativa_ciclo_idx`(`ciclo`),
    UNIQUE INDEX `Iniciativa_municipioId_codigo_key`(`municipioId`, `codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IniciativaSecretaria` (
    `id` VARCHAR(191) NOT NULL,
    `iniciativaId` VARCHAR(191) NOT NULL,
    `secretariaId` VARCHAR(191) NOT NULL,
    `papel` VARCHAR(191) NOT NULL DEFAULT 'CORRESPONSAVEL',
    `responsavel` VARCHAR(191) NULL,

    UNIQUE INDEX `IniciativaSecretaria_iniciativaId_secretariaId_key`(`iniciativaId`, `secretariaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IniciativaCompromisso` (
    `id` VARCHAR(191) NOT NULL,
    `iniciativaId` VARCHAR(191) NOT NULL,
    `compromissoId` VARCHAR(191) NOT NULL,
    `tipoContribuicao` VARCHAR(191) NULL,
    `origemVinculo` VARCHAR(191) NULL,

    UNIQUE INDEX `IniciativaCompromisso_iniciativaId_compromissoId_key`(`iniciativaId`, `compromissoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EquipamentoPublico` (
    `id` VARCHAR(191) NOT NULL,
    `municipioId` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `tipo` VARCHAR(191) NULL,
    `endereco` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EquipamentoPublico_municipioId_idx`(`municipioId`),
    UNIQUE INDEX `EquipamentoPublico_municipioId_nome_key`(`municipioId`, `nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IniciativaEquipamento` (
    `id` VARCHAR(191) NOT NULL,
    `iniciativaId` VARCHAR(191) NOT NULL,
    `equipamentoId` VARCHAR(191) NOT NULL,
    `tipoVinculo` VARCHAR(191) NOT NULL DEFAULT 'RELACIONADO',
    `validado` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `IniciativaEquipamento_iniciativaId_equipamentoId_key`(`iniciativaId`, `equipamentoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MarcoEntrega` (
    `id` VARCHAR(191) NOT NULL,
    `iniciativaId` VARCHAR(191) NOT NULL,
    `equipamentoId` VARCHAR(191) NULL,
    `codigo` VARCHAR(191) NULL,
    `descricao` TEXT NOT NULL,
    `ordem` INTEGER NOT NULL DEFAULT 0,
    `responsavel` VARCHAR(191) NULL,
    `prazoOriginal` DATETIME(3) NULL,
    `prazoVigente` DATETIME(3) NULL,
    `concluidoEm` DATETIME(3) NULL,
    `encerradoSemSolucaoEm` DATETIME(3) NULL,
    `motivoEncerramento` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MarcoEntrega_iniciativaId_idx`(`iniciativaId`),
    INDEX `MarcoEntrega_prazoVigente_idx`(`prazoVigente`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Subtarefa` (
    `id` VARCHAR(191) NOT NULL,
    `marcoId` VARCHAR(191) NOT NULL,
    `descricao` TEXT NOT NULL,
    `responsavel` VARCHAR(191) NULL,
    `concluida` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Subtarefa_marcoId_idx`(`marcoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Reprogramacao` (
    `id` VARCHAR(191) NOT NULL,
    `marcoId` VARCHAR(191) NOT NULL,
    `dataAnterior` DATETIME(3) NULL,
    `dataNova` DATETIME(3) NOT NULL,
    `motivo` TEXT NOT NULL,
    `autorId` VARCHAR(191) NULL,
    `autorizacao` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Reprogramacao_marcoId_idx`(`marcoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TipoVerificacao` (
    `id` VARCHAR(191) NOT NULL,
    `codigo` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `descricao` TEXT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `TipoVerificacao_codigo_key`(`codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Verificacao` (
    `id` VARCHAR(191) NOT NULL,
    `iniciativaId` VARCHAR(191) NOT NULL,
    `tipoVerificacaoId` VARCHAR(191) NOT NULL,
    `aplicabilidade` VARCHAR(191) NOT NULL DEFAULT 'A_AVALIAR',
    `situacao` VARCHAR(191) NOT NULL DEFAULT 'NAO_INICIADA',
    `responsavel` VARCHAR(191) NULL,
    `justificativa` TEXT NULL,
    `documentoFonte` VARCHAR(191) NULL,
    `efeitoNoAvanco` VARCHAR(191) NOT NULL DEFAULT 'INFORMATIVO',
    `proximaAcao` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Verificacao_iniciativaId_idx`(`iniciativaId`),
    UNIQUE INDEX `Verificacao_iniciativaId_tipoVerificacaoId_key`(`iniciativaId`, `tipoVerificacaoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Impedimento` (
    `id` VARCHAR(191) NOT NULL,
    `iniciativaId` VARCHAR(191) NOT NULL,
    `marcoId` VARCHAR(191) NULL,
    `tipo` VARCHAR(191) NULL,
    `descricao` TEXT NOT NULL,
    `gravidade` VARCHAR(191) NOT NULL DEFAULT 'MEDIA',
    `responsavel` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ABERTO',
    `proximoPasso` TEXT NULL,
    `prazo` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Impedimento_iniciativaId_idx`(`iniciativaId`),
    INDEX `Impedimento_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DecisaoProvidencia` (
    `id` VARCHAR(191) NOT NULL,
    `iniciativaId` VARCHAR(191) NOT NULL,
    `impedimentoId` VARCHAR(191) NULL,
    `descricao` TEXT NOT NULL,
    `responsavel` VARCHAR(191) NULL,
    `autorId` VARCHAR(191) NULL,
    `prazo` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ABERTA',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DecisaoProvidencia_iniciativaId_idx`(`iniciativaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Evidencia` (
    `id` VARCHAR(191) NOT NULL,
    `iniciativaId` VARCHAR(191) NOT NULL,
    `marcoId` VARCHAR(191) NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `descricao` TEXT NULL,
    `tipo` VARCHAR(191) NULL,
    `urlOuArquivo` VARCHAR(191) NULL,
    `fonte` VARCHAR(191) NULL,
    `autorNome` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DECLARADA',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Evidencia_iniciativaId_idx`(`iniciativaId`),
    INDEX `Evidencia_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ValidacaoEvidencia` (
    `id` VARCHAR(191) NOT NULL,
    `evidenciaId` VARCHAR(191) NOT NULL,
    `validadorId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL,
    `parecer` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ValidacaoEvidencia_evidenciaId_idx`(`evidenciaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ImportacaoSnapshot` (
    `id` VARCHAR(191) NOT NULL,
    `municipioId` VARCHAR(191) NOT NULL,
    `autorId` VARCHAR(191) NULL,
    `nomeArquivo` VARCHAR(191) NOT NULL,
    `dataReferencia` DATETIME(3) NOT NULL,
    `fonte` VARCHAR(191) NULL,
    `totalLinhas` INTEGER NOT NULL DEFAULT 0,
    `importadas` INTEGER NOT NULL DEFAULT 0,
    `conflitos` INTEGER NOT NULL DEFAULT 0,
    `resultado` VARCHAR(191) NOT NULL DEFAULT 'PENDENTE',
    `mapaCampos` JSON NULL,
    `log` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ImportacaoSnapshot_municipioId_idx`(`municipioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ImportacaoConflito` (
    `id` VARCHAR(191) NOT NULL,
    `importacaoId` VARCHAR(191) NOT NULL,
    `chaveExterna` VARCHAR(191) NOT NULL,
    `campo` VARCHAR(191) NULL,
    `valorAtual` TEXT NULL,
    `valorNovo` TEXT NULL,
    `resolvido` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ImportacaoConflito_importacaoId_idx`(`importacaoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `municipioId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `entity` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NULL,
    `before` JSON NULL,
    `after` JSON NULL,
    `ip` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_entity_entityId_idx`(`entity`, `entityId`),
    INDEX `AuditLog_municipioId_idx`(`municipioId`),
    INDEX `AuditLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Relatorio` (
    `id` VARCHAR(191) NOT NULL,
    `municipioId` VARCHAR(191) NOT NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `filtros` JSON NULL,
    `geradoPorId` VARCHAR(191) NULL,
    `arquivoUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Relatorio_municipioId_idx`(`municipioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RolePermission` ADD CONSTRAINT `RolePermission_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RolePermission` ADD CONSTRAINT `RolePermission_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `Permission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SessionToken` ADD CONSTRAINT `SessionToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VinculoUsuarioMunicipio` ADD CONSTRAINT `VinculoUsuarioMunicipio_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VinculoUsuarioMunicipio` ADD CONSTRAINT `VinculoUsuarioMunicipio_municipioId_fkey` FOREIGN KEY (`municipioId`) REFERENCES `Municipio`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlanoGoverno` ADD CONSTRAINT `PlanoGoverno_municipioId_fkey` FOREIGN KEY (`municipioId`) REFERENCES `Municipio`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Secretaria` ADD CONSTRAINT `Secretaria_municipioId_fkey` FOREIGN KEY (`municipioId`) REFERENCES `Municipio`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MetaEstrategica` ADD CONSTRAINT `MetaEstrategica_planoId_fkey` FOREIGN KEY (`planoId`) REFERENCES `PlanoGoverno`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MetaEstrategica` ADD CONSTRAINT `MetaEstrategica_secretariaId_fkey` FOREIGN KEY (`secretariaId`) REFERENCES `Secretaria`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Compromisso` ADD CONSTRAINT `Compromisso_municipioId_fkey` FOREIGN KEY (`municipioId`) REFERENCES `Municipio`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Iniciativa` ADD CONSTRAINT `Iniciativa_municipioId_fkey` FOREIGN KEY (`municipioId`) REFERENCES `Municipio`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Iniciativa` ADD CONSTRAINT `Iniciativa_secretariaPrincipalId_fkey` FOREIGN KEY (`secretariaPrincipalId`) REFERENCES `Secretaria`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Iniciativa` ADD CONSTRAINT `Iniciativa_metaEstrategicaId_fkey` FOREIGN KEY (`metaEstrategicaId`) REFERENCES `MetaEstrategica`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IniciativaSecretaria` ADD CONSTRAINT `IniciativaSecretaria_iniciativaId_fkey` FOREIGN KEY (`iniciativaId`) REFERENCES `Iniciativa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IniciativaSecretaria` ADD CONSTRAINT `IniciativaSecretaria_secretariaId_fkey` FOREIGN KEY (`secretariaId`) REFERENCES `Secretaria`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IniciativaCompromisso` ADD CONSTRAINT `IniciativaCompromisso_iniciativaId_fkey` FOREIGN KEY (`iniciativaId`) REFERENCES `Iniciativa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IniciativaCompromisso` ADD CONSTRAINT `IniciativaCompromisso_compromissoId_fkey` FOREIGN KEY (`compromissoId`) REFERENCES `Compromisso`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EquipamentoPublico` ADD CONSTRAINT `EquipamentoPublico_municipioId_fkey` FOREIGN KEY (`municipioId`) REFERENCES `Municipio`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IniciativaEquipamento` ADD CONSTRAINT `IniciativaEquipamento_iniciativaId_fkey` FOREIGN KEY (`iniciativaId`) REFERENCES `Iniciativa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IniciativaEquipamento` ADD CONSTRAINT `IniciativaEquipamento_equipamentoId_fkey` FOREIGN KEY (`equipamentoId`) REFERENCES `EquipamentoPublico`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MarcoEntrega` ADD CONSTRAINT `MarcoEntrega_iniciativaId_fkey` FOREIGN KEY (`iniciativaId`) REFERENCES `Iniciativa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MarcoEntrega` ADD CONSTRAINT `MarcoEntrega_equipamentoId_fkey` FOREIGN KEY (`equipamentoId`) REFERENCES `EquipamentoPublico`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subtarefa` ADD CONSTRAINT `Subtarefa_marcoId_fkey` FOREIGN KEY (`marcoId`) REFERENCES `MarcoEntrega`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reprogramacao` ADD CONSTRAINT `Reprogramacao_marcoId_fkey` FOREIGN KEY (`marcoId`) REFERENCES `MarcoEntrega`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reprogramacao` ADD CONSTRAINT `Reprogramacao_autorId_fkey` FOREIGN KEY (`autorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Verificacao` ADD CONSTRAINT `Verificacao_iniciativaId_fkey` FOREIGN KEY (`iniciativaId`) REFERENCES `Iniciativa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Verificacao` ADD CONSTRAINT `Verificacao_tipoVerificacaoId_fkey` FOREIGN KEY (`tipoVerificacaoId`) REFERENCES `TipoVerificacao`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Impedimento` ADD CONSTRAINT `Impedimento_iniciativaId_fkey` FOREIGN KEY (`iniciativaId`) REFERENCES `Iniciativa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Impedimento` ADD CONSTRAINT `Impedimento_marcoId_fkey` FOREIGN KEY (`marcoId`) REFERENCES `MarcoEntrega`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DecisaoProvidencia` ADD CONSTRAINT `DecisaoProvidencia_iniciativaId_fkey` FOREIGN KEY (`iniciativaId`) REFERENCES `Iniciativa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DecisaoProvidencia` ADD CONSTRAINT `DecisaoProvidencia_impedimentoId_fkey` FOREIGN KEY (`impedimentoId`) REFERENCES `Impedimento`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DecisaoProvidencia` ADD CONSTRAINT `DecisaoProvidencia_autorId_fkey` FOREIGN KEY (`autorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Evidencia` ADD CONSTRAINT `Evidencia_iniciativaId_fkey` FOREIGN KEY (`iniciativaId`) REFERENCES `Iniciativa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Evidencia` ADD CONSTRAINT `Evidencia_marcoId_fkey` FOREIGN KEY (`marcoId`) REFERENCES `MarcoEntrega`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ValidacaoEvidencia` ADD CONSTRAINT `ValidacaoEvidencia_evidenciaId_fkey` FOREIGN KEY (`evidenciaId`) REFERENCES `Evidencia`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ValidacaoEvidencia` ADD CONSTRAINT `ValidacaoEvidencia_validadorId_fkey` FOREIGN KEY (`validadorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ImportacaoSnapshot` ADD CONSTRAINT `ImportacaoSnapshot_municipioId_fkey` FOREIGN KEY (`municipioId`) REFERENCES `Municipio`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ImportacaoSnapshot` ADD CONSTRAINT `ImportacaoSnapshot_autorId_fkey` FOREIGN KEY (`autorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ImportacaoConflito` ADD CONSTRAINT `ImportacaoConflito_importacaoId_fkey` FOREIGN KEY (`importacaoId`) REFERENCES `ImportacaoSnapshot`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

