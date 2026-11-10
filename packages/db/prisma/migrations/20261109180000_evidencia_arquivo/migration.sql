-- AlterTable Evidencia
ALTER TABLE `Evidencia` ADD COLUMN `mimeType` VARCHAR(191) NULL;
ALTER TABLE `Evidencia` ADD COLUMN `tamanhoBytes` INTEGER NULL;
ALTER TABLE `Evidencia` ADD COLUMN `arquivoNome` VARCHAR(191) NULL;

-- AlterTable MetaExecucao
ALTER TABLE `MetaExecucao` ADD COLUMN `valorAtual` VARCHAR(191) NULL;
