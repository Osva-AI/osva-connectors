export const CONNECTOR_KEY = "osva-connector-bigquery";
export const CONNECTOR_NAME = "OSVA Google BigQuery Connector";
export const CONNECTOR_VERSION = "0.1.0";

export const BIGQUERY_PROJECT_GET_TOOL = "bigquery.project.get";
export const BIGQUERY_DATASET_LIST_TOOL = "bigquery.dataset.list";
export const BIGQUERY_DATASET_GET_TOOL = "bigquery.dataset.get";
export const BIGQUERY_TABLE_LIST_TOOL = "bigquery.table.list";
export const BIGQUERY_TABLE_GET_TOOL = "bigquery.table.get";
export const BIGQUERY_TABLE_COLUMNS_LIST_TOOL = "bigquery.table.columns.list";
export const BIGQUERY_TABLE_ROWS_SAMPLE_TOOL = "bigquery.table.rows.sample";
export const BIGQUERY_TABLE_AGGREGATE_TOOL = "bigquery.table.aggregate";

export const BIGQUERY_PROJECT_ID_ENV = "OSVA_CONNECTOR_BIGQUERY_PROJECT_ID";
export const BIGQUERY_LOCATION_ENV = "OSVA_CONNECTOR_BIGQUERY_LOCATION";
export const BIGQUERY_ALLOWED_DATASETS_ENV =
  "OSVA_CONNECTOR_BIGQUERY_ALLOWED_DATASETS";
export const BIGQUERY_ALLOWED_TABLES_ENV =
  "OSVA_CONNECTOR_BIGQUERY_ALLOWED_TABLES";
export const BIGQUERY_MAX_BYTES_BILLED_ENV =
  "OSVA_CONNECTOR_BIGQUERY_MAX_BYTES_BILLED";
export const BIGQUERY_QUERY_TIMEOUT_MS_ENV =
  "OSVA_CONNECTOR_BIGQUERY_QUERY_TIMEOUT_MS";
export const BIGQUERY_REQUEST_TIMEOUT_MS_ENV =
  "OSVA_CONNECTOR_BIGQUERY_REQUEST_TIMEOUT_MS";

export const DEFAULT_LOCATION = "US";
export const DEFAULT_QUERY_TIMEOUT_MS = 30_000;
export const MIN_QUERY_TIMEOUT_MS = 1_000;
export const MAX_QUERY_TIMEOUT_MS = 120_000;

export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
export const MIN_REQUEST_TIMEOUT_MS = 1_000;
export const MAX_REQUEST_TIMEOUT_MS = 120_000;

export const DEFAULT_MAX_BYTES_BILLED = 1_000_000_000;
export const MIN_MAX_BYTES_BILLED = 1_000_000;
export const MAX_MAX_BYTES_BILLED = 100_000_000_000;

export const LIST_DEFAULT_PAGE_SIZE = 20;
export const LIST_MAX_PAGE_SIZE = 50;

export const ROWS_SAMPLE_DEFAULT_LIMIT = 20;
export const ROWS_SAMPLE_MAX_LIMIT = 100;
export const AGGREGATE_MAX_LIMIT = 500;

export const MAX_DATASET_ID_LENGTH = 256;
export const MAX_TABLE_ID_LENGTH = 256;
export const MAX_COLUMN_NAME_LENGTH = 128;
export const MAX_CONTINUATION_TOKEN_LENGTH = 256;
export const MAX_CONTINUATION_STORE_ENTRIES = 2_048;
export const DEFAULT_CONTINUATION_TTL_MS = 15 * 60 * 1000;

export const OUTPUT_MAX_STRUCTURED_JSON_BYTES = 262_144;
export const MAX_QUERY_CONCURRENCY = 2;
export const MAX_GROUP_BY_COLUMNS = 2;
export const MAX_METRICS = 8;
export const MAX_FILTER_DEPTH = 5;
export const MAX_IN_LIST_SIZE = 50;

export const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const PROJECT_ID_PATTERN = /^[a-z][a-z0-9-]{4,62}$/i;
