-- Oliveira Assessoria | Neon PostgreSQL | Preview-only schema
-- Apply only to a NEW, DEDICATED and BACKED-UP Neon database/branch.
-- This creates schema ONLY; no demo employees, admin passwords or client data.
-- All statements are idempotent. Never run this in an unrelated database.
BEGIN;

CREATE TABLE IF NOT EXISTS oliveira_staff_accounts (
  id uuid PRIMARY KEY,
  email text UNIQUE NOT NULL,
  display_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin','operator','reviewer')),
  status text NOT NULL CHECK (status IN ('pending-mfa','active','disabled')),
  secret_hash text NOT NULL,
  secret_salt text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  disabled_at timestamptz
);
CREATE TABLE IF NOT EXISTS oliveira_staff_sessions (
  id uuid PRIMARY KEY,
  staff_id uuid NOT NULL REFERENCES oliveira_staff_accounts(id) ON DELETE CASCADE,
  token_digest text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS oliveira_staff_sessions_owner_idx
  ON oliveira_staff_sessions(staff_id, expires_at);

CREATE TABLE IF NOT EXISTS oliveira_staff_mfa (
  staff_id uuid PRIMARY KEY REFERENCES oliveira_staff_accounts(id) ON DELETE CASCADE,
  secret bytea NOT NULL,
  confirmed boolean NOT NULL DEFAULT false,
  last_counter bigint NOT NULL DEFAULT -1
);

CREATE TABLE IF NOT EXISTS oliveira_login_limits (
  bucket_key text PRIMARY KEY,
  attempts integer NOT NULL CHECK (attempts >= 0),
  window_ends_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS oliveira_operational_cases (
  id uuid PRIMARY KEY,
  assigned_to uuid NOT NULL REFERENCES oliveira_staff_accounts(id),
  reviewer_id uuid REFERENCES oliveira_staff_accounts(id),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  status text NOT NULL CHECK (status IN
    ('triagem','aguardando_documentos','conferencia','pendencias',
     'preparado','acompanhamento','pausado','encerrado')),
  encrypted_payload bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS oliveira_operational_cases_assignee_idx
  ON oliveira_operational_cases(assigned_to, updated_at DESC);
CREATE INDEX IF NOT EXISTS oliveira_operational_cases_reviewer_idx
  ON oliveira_operational_cases(reviewer_id, updated_at DESC);


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
