export const CONNECTOR_KEY = "osva-connector-postgres";
export const CONNECTOR_NAME = "OSVA PostgreSQL Connector";
export const CONNECTOR_VERSION = "0.1.0";

/** MCP tool name (dot-separated, stable for Connector Profile V1). */
export const POSTGRES_CONNECTION_TEST_TOOL = "postgres.connection.test";
export const POSTGRES_SCHEMA_LIST_TOOL = "postgres.schema.list";
export const POSTGRES_TABLE_LIST_TOOL = "postgres.table.list";
export const POSTGRES_COLUMN_LIST_TOOL = "postgres.column.list";
export const POSTGRES_QUERY_READ_TOOL = "postgres.query.read";

export const POSTGRES_URL_ENV = "OSVA_CONNECTOR_POSTGRES_URL";
export const POSTGRES_ALLOWED_SCHEMAS_ENV =
  "OSVA_CONNECTOR_POSTGRES_ALLOWED_SCHEMAS";
export const POSTGRES_SSL_MODE_ENV = "OSVA_CONNECTOR_POSTGRES_SSL_MODE";
export const POSTGRES_CONNECT_TIMEOUT_MS_ENV =
  "OSVA_CONNECTOR_POSTGRES_CONNECT_TIMEOUT_MS";
export const POSTGRES_QUERY_TIMEOUT_MS_ENV =
  "OSVA_CONNECTOR_POSTGRES_QUERY_TIMEOUT_MS";
export const POSTGRES_POOL_MAX_ENV = "OSVA_CONNECTOR_POSTGRES_POOL_MAX";

export const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;
export const MIN_CONNECT_TIMEOUT_MS = 1_000;
export const MAX_CONNECT_TIMEOUT_MS = 60_000;

export const DEFAULT_QUERY_TIMEOUT_MS = 30_000;
export const MIN_QUERY_TIMEOUT_MS = 1_000;
export const MAX_QUERY_TIMEOUT_MS = 120_000;

export const DEFAULT_POOL_MAX = 2;
export const MIN_POOL_MAX = 1;
export const MAX_POOL_MAX = 10;

/** Fixed health query — never accept arbitrary SQL from MCP clients. */
export const CONNECTION_TEST_SQL = "SELECT version() AS server_version";

export const OUTPUT_MAX_SERVER_VERSION_LENGTH = 512;

export const DISCOVERY_MAX_LIMIT = 100;
export const DISCOVERY_DEFAULT_LIMIT = 50;
