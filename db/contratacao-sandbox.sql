-- Execute em um banco exclusivo do sandbox. Use uma conta separada para migrações.
BEGIN;
CREATE SCHEMA IF NOT EXISTS contratacao;
CREATE TABLE IF NOT EXISTS contratacao.sessions (
  token_hash text PRIMARY KEY,
  actor uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('tester', 'jennifer', 'rodrigo')),
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS contratacao.rate_limits (
  scope text NOT NULL,
  bucket bigint NOT NULL,
  requests integer NOT NULL,
  PRIMARY KEY (scope, bucket)
);
CREATE TABLE IF NOT EXISTS contratacao.contracts (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  request_hash text NOT NULL,
  service_id text NOT NULL,
  catalog_version text NOT NULL,
  template_version text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'BRL' CHECK (currency = 'BRL'),
  private_data bytea NOT NULL,
  draft_pdf bytea,
  draft_hash text,
  signed_pdf bytea,
  signed_hash text,
  triage_reasons text[] NOT NULL,
  status text NOT NULL CHECK (status IN ('triagem','rascunho','preparando','reconciliar','aguardando_assinatura','assinado','cancelado')),
  signature_mode text CHECK (signature_mode IN ('email','embedded')),
  provider_step text,
  envelope_id uuid UNIQUE,
  document_id uuid UNIQUE,
  signer_id uuid,
  payment_method text CHECK (payment_method IN ('pix', 'cartao')),
  payment_status text NOT NULL DEFAULT 'desativado' CHECK (payment_status IN ('desativado', 'simulacao')),
  service_status text NOT NULL DEFAULT 'aguardando' CHECK (service_status IN ('aguardando','em_atendimento','finalizado')),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contracts_owner_created_idx ON contratacao.contracts (owner_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS contracts_created_idx ON contratacao.contracts (created_at DESC, id DESC);
CREATE TABLE IF NOT EXISTS contratacao.audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  contract_id uuid NOT NULL REFERENCES contratacao.contracts (id) ON DELETE CASCADE,
  actor text NOT NULL,
  action text NOT NULL,
  detail text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_contract_id_idx ON contratacao.audit (contract_id, id DESC);
CREATE TABLE IF NOT EXISTS contratacao.webhooks (
  event_hash text PRIMARY KEY,
  contract_id uuid NOT NULL REFERENCES contratacao.contracts (id) ON DELETE CASCADE,
  received_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
