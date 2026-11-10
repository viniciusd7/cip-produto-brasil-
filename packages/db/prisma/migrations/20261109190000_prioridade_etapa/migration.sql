-- Prioridade e etapa atual do projeto (dimensões independentes do ciclo).
ALTER TABLE `Iniciativa`
  ADD COLUMN `prioridadeNivel` VARCHAR(191) NULL,
  ADD COLUMN `etapaAtual` VARCHAR(191) NULL,
  ADD COLUMN `prontidaoPct` INTEGER NULL;
