-- Run once against a dedicated Postgres database using a migration credential.
-- The application's role needs SELECT and UPDATE on this table only.
CREATE TABLE IF NOT EXISTS zik_support_state (
  id smallint PRIMARY KEY CHECK (id = 1),
  data jsonb NOT NULL CHECK (data->>'version' = '1')
);
INSERT INTO zik_support_state (id, data) VALUES
  (1, '{"version":1,"ingestedErrorIds":[],"tickets":[],"bugs":[],"audit":[],"sessions":[],"limits":{}}')
ON CONFLICT (id) DO NOTHING;
