BEGIN;
CREATE TABLE IF NOT EXISTS pincio_lead_guard(id integer PRIMARY KEY CHECK(id=1));
INSERT INTO pincio_lead_guard(id) VALUES(1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS pincio_leads (
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  fingerprint char(64) NOT NULL,
  phone_hash char(64) NOT NULL,
  payload bytea NOT NULL,
  status text NOT NULL DEFAULT 'novo' CHECK(status IN ('novo','em_atendimento','proposta','contratado','encerrado')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pincio_leads_created_idx ON pincio_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS pincio_leads_fingerprint_idx ON pincio_leads(fingerprint,created_at DESC);
CREATE INDEX IF NOT EXISTS pincio_leads_phone_idx ON pincio_leads(phone_hash,created_at DESC);
COMMIT;
