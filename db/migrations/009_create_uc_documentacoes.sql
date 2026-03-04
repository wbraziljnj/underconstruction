-- Migration 009: criar tabela uc_documentacoes
-- Data: 2026-03-04

CREATE TABLE IF NOT EXISTS uc_documentacoes (
  docs_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  documento VARCHAR(255) NOT NULL,
  fase VARCHAR(255) NOT NULL,
  subfase VARCHAR(255) NULL,
  valor DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  dados_pagamento TEXT NULL,
  data_inclusao DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  data_entrega DATETIME(3) NULL,
  status ENUM('ABERTO','ANDAMENTO','PENDENTE','FINALIZADO') NOT NULL DEFAULT 'ABERTO',
  responsavel_id BIGINT UNSIGNED NULL,
  notas TEXT NULL,
  arquivo_path TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  code VARCHAR(100) NOT NULL,
  PRIMARY KEY (docs_id),
  KEY uc_documentacoes_code_idx (code),
  KEY uc_documentacoes_status_idx (status),
  KEY uc_documentacoes_fase_idx (fase),
  KEY uc_documentacoes_responsavel_idx (responsavel_id),
  CONSTRAINT uc_documentacoes_responsavel_fk
    FOREIGN KEY (responsavel_id) REFERENCES uc_users(user_id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

