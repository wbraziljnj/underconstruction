-- Migration 005: adicionar dados_pagamento em uc_faturas
-- Data: 2026-03-03

ALTER TABLE uc_faturas
  ADD COLUMN dados_pagamento TEXT NULL AFTER data_pagamento;

