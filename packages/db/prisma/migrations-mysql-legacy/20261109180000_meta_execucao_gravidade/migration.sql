-- AlterTable
ALTER TABLE `MarcoEntrega` ADD COLUMN `gravidade` VARCHAR(191) NULL,
    ADD COLUMN `metaExecucaoId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `MetaExecucao` (
    `id` VARCHAR(191) NOT NULL,
    `iniciativaId` VARCHAR(191) NOT NULL,
    `codigo` VARCHAR(191) NULL,
    `nome` VARCHAR(191) NOT NULL,
    `indicador` VARCHAR(191) NULL,
    `criterio` TEXT NULL,
    `alvo` VARCHAR(191) NULL,
    `unidade` VARCHAR(191) NULL,
    `responsavel` VARCHAR(191) NULL,
    `prazo` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'EM_ANDAMENTO',
    `ordem` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MetaExecucao_iniciativaId_idx`(`iniciativaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `MarcoEntrega_metaExecucaoId_idx` ON `MarcoEntrega`(`metaExecucaoId`);

-- AddForeignKey
ALTER TABLE `MetaExecucao` ADD CONSTRAINT `MetaExecucao_iniciativaId_fkey` FOREIGN KEY (`iniciativaId`) REFERENCES `Iniciativa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MarcoEntrega` ADD CONSTRAINT `MarcoEntrega_metaExecucaoId_fkey` FOREIGN KEY (`metaExecucaoId`) REFERENCES `MetaExecucao`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
