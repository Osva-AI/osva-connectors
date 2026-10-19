CREATE ROLE osva_reader LOGIN PASSWORD 'reader_pass';
CREATE ROLE osva_writer LOGIN PASSWORD 'writer_pass';

CREATE SCHEMA app;
CREATE SCHEMA secret;
CREATE SCHEMA analytics;

REVOKE ALL ON SCHEMA secret FROM PUBLIC;
REVOKE ALL ON SCHEMA secret FROM osva_reader;

GRANT USAGE ON SCHEMA app TO osva_reader;
GRANT USAGE ON SCHEMA analytics TO osva_reader;

CREATE TABLE app.users (
  id integer PRIMARY KEY,
  email text
);
INSERT INTO app.users (id, email) VALUES (1, 'one@example.com');
GRANT SELECT ON app.users TO osva_reader;

CREATE TABLE app.no_access (
  id integer PRIMARY KEY,
  secret text
);

CREATE TABLE app.partial_cols (
  id integer PRIMARY KEY,
  col_a text,
  col_b text
);
INSERT INTO app.partial_cols (id, col_a, col_b) VALUES (1, 'visible', 'secret');
GRANT SELECT (col_a) ON app.partial_cols TO osva_reader;

CREATE VIEW app.events_view AS
SELECT id, email FROM app.users;
GRANT SELECT ON app.events_view TO osva_reader;

CREATE TABLE secret.credentials (
  id integer PRIMARY KEY,
  token text
);

CREATE TABLE analytics.metrics (
  id integer PRIMARY KEY,
  value numeric
);
GRANT SELECT ON analytics.metrics TO osva_reader;

CREATE TABLE app.rls_items (
  id serial PRIMARY KEY,
  tenant text NOT NULL,
  label text NOT NULL
);
INSERT INTO app.rls_items (tenant, label) VALUES
  ('team_a', 'visible-a'),
  ('team_b', 'hidden-b');
ALTER TABLE app.rls_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_items_reader ON app.rls_items
  FOR SELECT TO osva_reader
  USING (tenant = 'team_a');
GRANT SELECT ON app.rls_items TO osva_reader;

CREATE OR REPLACE FUNCTION app.sleep_seconds(seconds numeric)
RETURNS void
LANGUAGE sql
STABLE
AS $$ SELECT pg_sleep(seconds); $$;
GRANT EXECUTE ON FUNCTION app.sleep_seconds(numeric) TO osva_reader;

GRANT CONNECT ON DATABASE osva_integration TO osva_writer;
GRANT USAGE ON SCHEMA app TO osva_writer;

CREATE TABLE app.read_only_probe (
  id serial PRIMARY KEY,
  note text NOT NULL
);
INSERT INTO app.read_only_probe (note) VALUES ('seed');
GRANT SELECT, INSERT, UPDATE, DELETE ON app.read_only_probe TO osva_writer;
GRANT USAGE, SELECT ON SEQUENCE app.read_only_probe_id_seq TO osva_writer;
