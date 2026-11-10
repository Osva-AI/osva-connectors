export const CONNECTOR_KEY = "osva-connector-pinecone";
export const CONNECTOR_NAME = "OSVA Pinecone Connector";
export const CONNECTOR_VERSION = "0.1.0";

export const PINECONE_INDEX_LIST_TOOL = "pinecone.index.list";
export const PINECONE_INDEX_DESCRIBE_TOOL = "pinecone.index.describe";
export const PINECONE_INDEX_STATS_TOOL = "pinecone.index.stats";
export const PINECONE_VECTOR_QUERY_TOOL = "pinecone.vector.query";
export const PINECONE_VECTOR_FETCH_TOOL = "pinecone.vector.fetch";
export const PINECONE_VECTOR_LIST_TOOL = "pinecone.vector.list";
export const PINECONE_VECTOR_UPSERT_TOOL = "pinecone.vector.upsert";

export const PINECONE_API_KEY_ENV = "OSVA_CONNECTOR_PINECONE_API_KEY";
export const PINECONE_ALLOWED_INDEXES_ENV =
  "OSVA_CONNECTOR_PINECONE_ALLOWED_INDEXES";
export const PINECONE_ALLOWED_NAMESPACES_ENV =
  "OSVA_CONNECTOR_PINECONE_ALLOWED_NAMESPACES";
export const PINECONE_WRITE_ENABLED_ENV =
  "OSVA_CONNECTOR_PINECONE_WRITE_ENABLED";
export const PINECONE_HOST_WRITES_APPROVED_ENV =
  "OSVA_CONNECTOR_PINECONE_HOST_WRITES_APPROVED";
export const PINECONE_TIMEOUT_MS_ENV = "OSVA_CONNECTOR_PINECONE_TIMEOUT_MS";

export const PINECONE_CONTROL_PLANE_HOST = "https://api.pinecone.io";
export const PINECONE_API_VERSION = "2025-10";

export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
export const MIN_REQUEST_TIMEOUT_MS = 1_000;
export const MAX_REQUEST_TIMEOUT_MS = 120_000;

export const MAX_INDEX_NAME_LENGTH = 128;
export const MAX_NAMESPACE_LENGTH = 256;
export const FETCH_MAX_IDS = 100;
export const MAX_VECTOR_ID_LENGTH = 512;
export const QUERY_DEFAULT_TOP_K = 10;
export const QUERY_MAX_TOP_K = 100;
export const LIST_DEFAULT_LIMIT = 100;
export const LIST_MAX_LIMIT = 100;
export const MAX_VECTOR_DIMENSION = 16_384;
export const MAX_UPSERT_VECTORS = 50;

export const MAX_HTTP_RESPONSE_BYTES = 2_097_152;
export const READ_ONLY_MAX_RETRIES = 1;
export const READ_ONLY_RETRY_DELAY_MS = 1_000;

export {
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  OUTPUT_MAX_STRUCTURED_JSON_BYTES,
} from "./output-budget.js";
