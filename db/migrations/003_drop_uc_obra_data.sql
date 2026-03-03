-- Migration 003: remover coluna `data` da uc_obra
-- Data: 2026-03-03

ALTER TABLE uc_obra DROP COLUMN data;

