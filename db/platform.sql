-- Dedicated preview database only. Apply explicitly; never mutate existing agent/n8n schemas.
BEGIN;
CREATE TABLE IF NOT EXISTS oliveira_platform_state (
  id uuid PRIMARY KEY,
  version bigint NOT NULL CHECK (version > 0),
  payload bytea NOT NULL
);
COMMENT ON COLUMN oliveira_platform_state.payload IS 'AES-256-GCM encrypted workspace; key held outside database. Bounded preview aggregate, not production scale.';
COMMIT;
