ALTER TABLE `User`
  ADD COLUMN `isPlatformAdmin` BOOLEAN NOT NULL DEFAULT false;

UPDATE `User` u
JOIN `UserRole` ur ON ur.`userId` = u.`id`
JOIN `Role` r ON r.`id` = ur.`roleId`
SET u.`isPlatformAdmin` = true
WHERE r.`code` = 'admin';

ALTER TABLE `Municipio`
  ADD COLUMN `mandatoInicio` DATETIME(3) NULL,
  ADD COLUMN `mandatoFim` DATETIME(3) NULL,
  ADD COLUMN `prefeitoNome` VARCHAR(191) NULL,
  ADD COLUMN `prefeitoTelefone` VARCHAR(191) NULL,
  ADD COLUMN `prefeitoEmail` VARCHAR(191) NULL,
  ADD COLUMN `consultorResponsavelId` VARCHAR(191) NULL;

CREATE INDEX `Municipio_consultorResponsavelId_idx`
  ON `Municipio`(`consultorResponsavelId`);

ALTER TABLE `Municipio`
  ADD CONSTRAINT `Municipio_consultorResponsavelId_fkey`
  FOREIGN KEY (`consultorResponsavelId`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `VinculoUsuarioMunicipio`
  ADD COLUMN `roleCode` VARCHAR(191) NOT NULL DEFAULT 'leitura';

UPDATE `VinculoUsuarioMunicipio` v
JOIN (
  SELECT
    ur.`userId`,
    CASE WHEN COUNT(DISTINCT r.`code`) = 1
      THEN MAX(CASE
        WHEN r.`code` IN ('analista', 'gestor', 'prefeito', 'leitura')
          THEN r.`code`
        ELSE NULL
      END)
      ELSE NULL
    END AS `roleCode`
  FROM `UserRole` ur
  JOIN `Role` r ON r.`id` = ur.`roleId`
  GROUP BY ur.`userId`
) roles ON roles.`userId` = v.`userId`
SET v.`roleCode` = roles.`roleCode`
WHERE roles.`roleCode` IS NOT NULL;
