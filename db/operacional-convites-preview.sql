-- Oliveira Assessoria | migração exclusiva da equipe | Preview branch
-- Executar no Neon dedicado, após snapshot/backup e conferência do projeto e branch.
-- Nenhuma credencial, funcionário ou convite é criado por esta migração.
BEGIN;
CREATE TABLE IF NOT EXISTS oliveira_staff_invitations (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  display_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('operator','reviewer')),
  kind text NOT NULL CHECK (kind IN ('invite','reset')),
  token_digest text UNIQUE NOT NULL,
  staff_id uuid REFERENCES oliveira_staff_accounts(id),
  created_by uuid NOT NULL REFERENCES oliveira_staff_accounts(id),
  expires_at timestamptz NOT NULL,
  redeemed_at timestamptz,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS oliveira_staff_invitations_expiry_idx
  ON oliveira_staff_invitations(expires_at);
COMMIT;
