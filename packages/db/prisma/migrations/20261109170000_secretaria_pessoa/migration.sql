-- CreateTable
CREATE TABLE `SecretariaPessoa` (
    `id` VARCHAR(191) NOT NULL,
    `secretariaId` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `cargo` VARCHAR(191) NOT NULL,
    `telefone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `papel` VARCHAR(191) NOT NULL DEFAULT 'EQUIPE',
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SecretariaPessoa_secretariaId_idx`(`secretariaId`),
    INDEX `SecretariaPessoa_secretariaId_ativo_idx`(`secretariaId`, `ativo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `SecretariaPessoa`
  ADD CONSTRAINT `SecretariaPessoa_secretariaId_fkey`
  FOREIGN KEY (`secretariaId`) REFERENCES `Secretaria`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable Iniciativa
ALTER TABLE `Iniciativa`
  ADD COLUMN `responsavelPessoaId` VARCHAR(191) NULL;

ALTER TABLE `Iniciativa`
  ADD INDEX `Iniciativa_responsavelPessoaId_idx`(`responsavelPessoaId`);

ALTER TABLE `Iniciativa`
  ADD CONSTRAINT `Iniciativa_responsavelPessoaId_fkey`
  FOREIGN KEY (`responsavelPessoaId`) REFERENCES `SecretariaPessoa`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill titulares existentes
INSERT INTO `SecretariaPessoa` (`id`, `secretariaId`, `nome`, `cargo`, `telefone`, `email`, `papel`, `ativo`, `createdAt`, `updatedAt`)
SELECT
  CONCAT('mig_', `id`),
  `id`,
  `titularNome`,
  COALESCE(NULLIF(`titularCargo`, ''), 'Titular'),
  `titularTelefone`,
  `titularEmail`,
  'TITULAR',
  true,
  NOW(3),
  NOW(3)
FROM `Secretaria`
WHERE `titularNome` IS NOT NULL AND TRIM(`titularNome`) <> '';
