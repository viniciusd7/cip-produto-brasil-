CREATE TABLE `Comunicado` (
 `id` VARCHAR(191) NOT NULL, `iniciativaId` VARCHAR(191) NOT NULL,
 `autorId` VARCHAR(191) NULL, `destinatarioId` VARCHAR(191) NULL, `destinoPapel` VARCHAR(191) NULL,
 `texto` TEXT NOT NULL, `tipo` VARCHAR(191) NOT NULL DEFAULT 'MENSAGEM',
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`),
 INDEX `Comunicado_iniciativaId_createdAt_idx` (`iniciativaId`, `createdAt`), INDEX `Comunicado_destinatarioId_idx` (`destinatarioId`),
 CONSTRAINT `Comunicado_iniciativaId_fkey` FOREIGN KEY (`iniciativaId`) REFERENCES `Iniciativa` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT `Comunicado_autorId_fkey` FOREIGN KEY (`autorId`) REFERENCES `User` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
 CONSTRAINT `Comunicado_destinatarioId_fkey` FOREIGN KEY (`destinatarioId`) REFERENCES `User` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `ComunicadoLeitura` (
 `comunicadoId` VARCHAR(191) NOT NULL, `userId` VARCHAR(191) NOT NULL,
 `lidoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`comunicadoId`, `userId`),
 CONSTRAINT `ComunicadoLeitura_comunicadoId_fkey` FOREIGN KEY (`comunicadoId`) REFERENCES `Comunicado` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT `ComunicadoLeitura_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
