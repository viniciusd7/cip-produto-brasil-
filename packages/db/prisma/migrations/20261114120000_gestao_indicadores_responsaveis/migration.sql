-- Responsáveis como usuários da plataforma (texto legado preservado)
ALTER TABLE `MetaEstrategica` ADD COLUMN `responsavelUserId` VARCHAR(191) NULL;
ALTER TABLE `MetaExecucao` ADD COLUMN `responsavelUserId` VARCHAR(191) NULL;
ALTER TABLE `MarcoEntrega` ADD COLUMN `responsavelUserId` VARCHAR(191) NULL;
ALTER TABLE `Subtarefa`
  ADD COLUMN `responsavelUserId` VARCHAR(191) NULL,
  ADD COLUMN `prazo` DATETIME(3) NULL;

CREATE INDEX `MetaEstrategica_responsavelUserId_idx` ON `MetaEstrategica`(`responsavelUserId`);
CREATE INDEX `MetaExecucao_responsavelUserId_idx` ON `MetaExecucao`(`responsavelUserId`);
CREATE INDEX `MarcoEntrega_responsavelUserId_idx` ON `MarcoEntrega`(`responsavelUserId`);
CREATE INDEX `Subtarefa_responsavelUserId_idx` ON `Subtarefa`(`responsavelUserId`);

ALTER TABLE `MetaEstrategica` ADD CONSTRAINT `MetaEstrategica_responsavelUserId_fkey`
  FOREIGN KEY (`responsavelUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `MetaExecucao` ADD CONSTRAINT `MetaExecucao_responsavelUserId_fkey`
  FOREIGN KEY (`responsavelUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `MarcoEntrega` ADD CONSTRAINT `MarcoEntrega_responsavelUserId_fkey`
  FOREIGN KEY (`responsavelUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Subtarefa` ADD CONSTRAINT `Subtarefa_responsavelUserId_fkey`
  FOREIGN KEY (`responsavelUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Indicador como entidade
CREATE TABLE `Indicador` (
  `id` VARCHAR(191) NOT NULL,
  `municipioId` VARCHAR(191) NOT NULL,
  `metaEstrategicaId` VARCHAR(191) NULL,
  `metaExecucaoId` VARCHAR(191) NULL,
  `nome` VARCHAR(191) NOT NULL,
  `descricao` TEXT NULL,
  `formula` TEXT NULL,
  `unidade` VARCHAR(191) NULL,
  `valorBase` VARCHAR(191) NULL,
  `alvo` VARCHAR(191) NULL,
  `valorAtual` VARCHAR(191) NULL,
  `periodicidade` VARCHAR(191) NULL,
  `fonte` VARCHAR(191) NULL,
  `polaridade` VARCHAR(191) NOT NULL DEFAULT 'MAIOR_MELHOR',
  `responsavelUserId` VARCHAR(191) NULL,
  `ativo` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `Indicador_municipioId_idx`(`municipioId`),
  INDEX `Indicador_metaEstrategicaId_idx`(`metaEstrategicaId`),
  INDEX `Indicador_metaExecucaoId_idx`(`metaExecucaoId`),
  INDEX `Indicador_responsavelUserId_idx`(`responsavelUserId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Indicador` ADD CONSTRAINT `Indicador_municipioId_fkey`
  FOREIGN KEY (`municipioId`) REFERENCES `Municipio`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Indicador` ADD CONSTRAINT `Indicador_metaEstrategicaId_fkey`
  FOREIGN KEY (`metaEstrategicaId`) REFERENCES `MetaEstrategica`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Indicador` ADD CONSTRAINT `Indicador_metaExecucaoId_fkey`
  FOREIGN KEY (`metaExecucaoId`) REFERENCES `MetaExecucao`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Indicador` ADD CONSTRAINT `Indicador_responsavelUserId_fkey`
  FOREIGN KEY (`responsavelUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Medicao` ADD COLUMN `indicadorId` VARCHAR(191) NULL;
CREATE INDEX `Medicao_indicadorId_dataCorte_idx` ON `Medicao`(`indicadorId`, `dataCorte`);
ALTER TABLE `Medicao` ADD CONSTRAINT `Medicao_indicadorId_fkey`
  FOREIGN KEY (`indicadorId`) REFERENCES `Indicador`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Migra o indicador textual legado de cada meta estratégica
INSERT INTO `Indicador` (`id`, `municipioId`, `metaEstrategicaId`, `nome`, `unidade`, `valorBase`, `alvo`, `periodicidade`, `createdAt`, `updatedAt`)
SELECT CONCAT('ind', SUBSTRING(m.`id`, 4)), p.`municipioId`, m.`id`, m.`indicador`, m.`unidade`, m.`valorBase`, m.`alvo`, m.`periodicidade`, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `MetaEstrategica` m
JOIN `PlanoGoverno` p ON p.`id` = m.`planoId`
WHERE m.`indicador` IS NOT NULL AND TRIM(m.`indicador`) <> '';

UPDATE `Medicao` md
JOIN `Indicador` i ON i.`metaEstrategicaId` = md.`metaEstrategicaId`
SET md.`indicadorId` = i.`id`
WHERE md.`metaEstrategicaId` IS NOT NULL AND md.`indicadorId` IS NULL;

UPDATE `Indicador` i
SET i.`valorAtual` = (
  SELECT md.`valorRealizado` FROM `Medicao` md
  WHERE md.`indicadorId` = i.`id`
  ORDER BY md.`dataCorte` DESC LIMIT 1
);

-- Pedido de mudança (conclusão/reprogramação) com dados estruturados
ALTER TABLE `SolicitacaoValidacao` ADD COLUMN `payload` JSON NULL;

-- Notificações internas por usuário
CREATE TABLE `Notificacao` (
  `id` VARCHAR(191) NOT NULL,
  `municipioId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `tipo` VARCHAR(191) NOT NULL,
  `titulo` VARCHAR(191) NOT NULL,
  `texto` TEXT NOT NULL,
  `link` VARCHAR(191) NULL,
  `entidadeTipo` VARCHAR(191) NULL,
  `entidadeId` VARCHAR(191) NULL,
  `lidaEm` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `Notificacao_userId_municipioId_lidaEm_idx`(`userId`, `municipioId`, `lidaEm`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Notificacao` ADD CONSTRAINT `Notificacao_municipioId_fkey`
  FOREIGN KEY (`municipioId`) REFERENCES `Municipio`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Notificacao` ADD CONSTRAINT `Notificacao_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
