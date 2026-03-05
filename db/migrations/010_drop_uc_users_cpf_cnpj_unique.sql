-- Under Construction
-- Remove trava de CPF/CNPJ único para permitir "perfil agregado" com CPF repetido.

ALTER TABLE uc_users
  DROP INDEX uc_users_cpf_cnpj_uq;

