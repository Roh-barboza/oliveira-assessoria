-- Oliveira Assessoria | Preparação de documentos privados | Preview exclusivo
-- NÃO habilita uploads reais: scanner, LGPD e backup devem ser homologados.
-- Execute somente em banco dedicado após snapshot/backup.
BEGIN;
CREATE TABLE IF NOT EXISTS oliveira_operational_documents (
  id uuid PRIMARY KEY,
  case_id uuid NOT NULL REFERENCES oliveira_operational_cases(id),
  uploaded_by uuid NOT NULL REFERENCES oliveira_staff_accounts(id),
  media_type text NOT NULL CHECK (media_type IN ('application/pdf','image/png','image/jpeg')),
  byte_length integer NOT NULL CHECK (byte_length>0 AND byte_length<=1048576),
  sha256 text NOT NULL,
  sealed_name bytea NOT NULL,
  sealed_bytes bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS oliveira_documents_case_idx
  ON oliveira_operational_documents(case_id,created_at DESC);
CREATE TABLE IF NOT EXISTS oliveira_document_access_log (
  id uuid PRIMARY KEY,
  document_id uuid NOT NULL,
  case_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('uploaded','downloaded','deleted')),
  at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
