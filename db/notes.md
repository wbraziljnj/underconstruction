# Banco de dados — inspeção inicial (MySQL)

Data da inspeção: 2026-03-03

Conexão usada:
- Host: `mysql.wbrazilsoftwares.com.br` (conectou com sucesso)
- Database: `wbrazilsoftwar`

## Tabelas existentes inspecionadas

### `uc_users`
- PK: `user_id` (`char(36)`) **não é auto-increment**
- Campos relevantes:
  - `foto` (text, null)
  - `tipo_usuario` (enum: `Pedreiro`, `Ajudante`, `FornecedorMateriais`, `Engenheiro`, `PrestadorServico`, `Gerente`, `Owner`)
  - `cpf_cnpj` (varchar(32), unique)
  - `status` (enum: `ATIVO`/`INATIVO`, default `ATIVO`)
  - `created_at`, `updated_at` (datetime(3))
  - **Campo de obra existente**: `code` (varchar(100), NOT NULL)

### `uc_fases`
- PK: `fase_id` (`char(36)`) **não é auto-increment**
- FKs:
  - `responsavel_id` → `uc_users.user_id` (ON DELETE SET NULL)
- Campos relevantes:
  - `data_inicio`, `previsao_finalizacao`, `data_finalizacao` (datetime(3))
  - `valor_total`, `valor_parcial` (decimal(12,2))
  - `deleted_at` (datetime(3), null)
  - **Campo de obra existente**: `code` (varchar(100), NOT NULL)

### `uc_faturas`
- PK: `fatura_id` (`char(36)`) **não é auto-increment**
- FKs:
  - `fase_id` → `uc_fases.fase_id` (ON DELETE CASCADE)
  - `responsavel_id` → `uc_users.user_id` (ON DELETE SET NULL)
  - `empresa_id` → `uc_users.user_id` (ON DELETE SET NULL)
- Campos relevantes:
  - `pagamento` (enum: `aberto`/`pendente`/`pago`)
  - `valor` (decimal(12,2)), `quantidade` (int), `total` (decimal(14,2))
  - `data`, `lancamento`, `data_pagamento` (datetime(3))
  - **Campo de obra existente**: `code` (varchar(100), NOT NULL)

## Divergências vs. spec do novo sistema

- O spec pede `codigo` em todas as tabelas; o banco atualmente usa o nome `code`.
- O spec/PS pede IDs auto-increment; as 3 tabelas existentes usam `char(36)` como PK (UUID/texto).

Decisão:
- **Priorizar a estrutura real** (manter PKs `char(36)` nas tabelas existentes).
- Criar migration para **adicionar `codigo`** e **backfill a partir de `code`** (mantendo `code` por compatibilidade).

