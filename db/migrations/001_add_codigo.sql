-- Migration 001: adicionar campo `codigo` (obra) nas tabelas existentes
-- Data: 2026-03-03
--
-- Contexto:
-- - As tabelas atuais têm o campo `code` (varchar(100) NOT NULL) para identificar a obra.
-- - O novo sistema exige `codigo` (string) em TODAS as tabelas.
-- - Esta migration adiciona `codigo`, preenche com o valor de `code` e cria índices.
--
-- Observação:
-- - Mantemos `code` por compatibilidade com dados/integrações existentes.

START TRANSACTION;

-- 1) uc_users
ALTER TABLE `uc_users`
  ADD COLUMN `codigo` varchar(100) NULL AFTER `code`;

UPDATE `uc_users`
  SET `codigo` = `code`
  WHERE `codigo` IS NULL OR `codigo` = '';

ALTER TABLE `uc_users`
  MODIFY COLUMN `codigo` varchar(100) NOT NULL;

CREATE INDEX `uc_users_codigo_idx` ON `uc_users` (`codigo`);

-- 2) uc_fases
ALTER TABLE `uc_fases`
  ADD COLUMN `codigo` varchar(100) NULL AFTER `code`;

UPDATE `uc_fases`
  SET `codigo` = `code`
  WHERE `codigo` IS NULL OR `codigo` = '';

ALTER TABLE `uc_fases`
  MODIFY COLUMN `codigo` varchar(100) NOT NULL;

CREATE INDEX `uc_fases_codigo_idx` ON `uc_fases` (`codigo`);

-- 3) uc_faturas
ALTER TABLE `uc_faturas`
  ADD COLUMN `codigo` varchar(100) NULL AFTER `code`;

UPDATE `uc_faturas`
  SET `codigo` = `code`
  WHERE `codigo` IS NULL OR `codigo` = '';

ALTER TABLE `uc_faturas`
  MODIFY COLUMN `codigo` varchar(100) NOT NULL;

CREATE INDEX `uc_faturas_codigo_idx` ON `uc_faturas` (`codigo`);

COMMIT;

