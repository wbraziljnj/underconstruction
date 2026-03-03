-- Migration 002: criar tabela uc_obra
-- Data: 2026-03-03

CREATE TABLE IF NOT EXISTS uc_obra (
  obra_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  foto TEXT NULL,
  nome VARCHAR(255) NOT NULL,
  caderneta TEXT NULL,
  responsavel VARCHAR(255) NULL,
  rua VARCHAR(255) NULL,
  numero VARCHAR(50) NULL,
  bairro VARCHAR(120) NULL,
  cidade VARCHAR(120) NULL,
  cep VARCHAR(20) NULL,
  matricula VARCHAR(60) NULL,
  engenheiro_responsavel VARCHAR(255) NULL,
  data DATE NULL,
  data_inicio DATE NULL,
  data_previsao_finalizacao DATE NULL,
  codigo VARCHAR(100) NOT NULL,
  notas TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (obra_id),
  UNIQUE KEY uc_obra_codigo_uq (codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

