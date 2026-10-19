CREATE ROLE osva_reader LOGIN PASSWORD 'reader_pass';

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
