ALTER TABLE `VinculoUsuarioMunicipio`
  ADD COLUMN `secretariaId` VARCHAR(191) NULL;

CREATE INDEX `VinculoUsuarioMunicipio_secretariaId_idx`
  ON `VinculoUsuarioMunicipio`(`secretariaId`);

ALTER TABLE `VinculoUsuarioMunicipio`
  ADD CONSTRAINT `VinculoUsuarioMunicipio_secretariaId_fkey`
  FOREIGN KEY (`secretariaId`) REFERENCES `Secretaria`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
