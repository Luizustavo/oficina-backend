-- Rodado pelo job de migração depois do `migrate deploy`, como dono da tabela (os_user).
-- Contrato com a Lambda de CPF (ADR-014): ela lê só estas quatro colunas.
GRANT SELECT (id, name, email, document) ON customers TO auth_reader;
