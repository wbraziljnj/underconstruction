-- Migration 006: adicionar nfe (código de barras/linha digitável) em uc_faturas
-- Data: 2026-03-03

ALTER TABLE uc_faturas
  ADD COLUMN nfe VARCHAR(255) NULL AFTER dados_pagamento;

