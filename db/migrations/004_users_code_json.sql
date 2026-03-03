-- Migration 004: permitir múltiplas obras por usuário (uc_users.code como JSON array)
-- Data: 2026-03-03
--
-- Converte `uc_users.code` (string) para JSON contendo array de códigos.
-- Ex: "minhaobra" -> ["minhaobra"]
--
-- Estratégia segura: cria coluna nova, preenche, troca.

ALTER TABLE uc_users ADD COLUMN code_json JSON NULL AFTER code;

UPDATE uc_users SET code_json = JSON_ARRAY(code);

ALTER TABLE uc_users DROP COLUMN code;
ALTER TABLE uc_users CHANGE COLUMN code_json code JSON NOT NULL;
