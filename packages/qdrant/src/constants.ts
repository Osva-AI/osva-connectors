export const CONNECTOR_KEY = "osva-connector-qdrant";
export const CONNECTOR_NAME = "OSVA Qdrant Connector";
export const CONNECTOR_VERSION = "0.1.0";

export const QDRANT_COLLECTION_LIST_TOOL = "qdrant.collection.list";
export const QDRANT_COLLECTION_GET_TOOL = "qdrant.collection.get";
export const QDRANT_POINT_GET_TOOL = "qdrant.point.get";
export const QDRANT_POINT_SCROLL_TOOL = "qdrant.point.scroll";
export const QDRANT_POINT_QUERY_TOOL = "qdrant.point.query";
export const QDRANT_POINT_COUNT_TOOL = "qdrant.point.count";
export const QDRANT_POINT_UPSERT_TOOL = "qdrant.point.upsert";

export const QDRANT_URL_ENV = "OSVA_CONNECTOR_QDRANT_URL";
export const QDRANT_API_KEY_ENV = "OSVA_CONNECTOR_QDRANT_API_KEY";
export const QDRANT_ALLOWED_COLLECTIONS_ENV =
  "OSVA_CONNECTOR_QDRANT_ALLOWED_COLLECTIONS";
export const QDRANT_ALLOW_LOCAL_HTTP_ENV =
  "OSVA_CONNECTOR_QDRANT_ALLOW_LOCAL_HTTP";
export const QDRANT_WRITE_ENABLED_ENV = "OSVA_CONNECTOR_QDRANT_WRITE_ENABLED";
export const QDRANT_HOST_WRITES_APPROVED_ENV =
  "OSVA_CONNECTOR_QDRANT_HOST_WRITES_APPROVED";
export const QDRANT_TIMEOUT_MS_ENV = "OSVA_CONNECTOR_QDRANT_TIMEOUT_MS";

export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
export const MIN_REQUEST_TIMEOUT_MS = 1_000;
export const MAX_REQUEST_TIMEOUT_MS = 120_000;

export const MAX_COLLECTION_NAME_LENGTH = 256;
export const MAX_POINT_IDS = 100;
export const MAX_POINT_ID_LENGTH = 512;
export const SCROLL_DEFAULT_LIMIT = 10;
export const SCROLL_MAX_LIMIT = 100;
export const QUERY_DEFAULT_LIMIT = 10;
export const QUERY_MAX_LIMIT = 100;
export const MAX_VECTOR_DIMENSION = 16_384;
export const MAX_UPSERT_POINTS = 50;
export const MAX_BASE_URL_LENGTH = 2_048;

export const MAX_HTTP_RESPONSE_BYTES = 2_097_152;
export const READ_ONLY_MAX_RETRIES = 1;
export const READ_ONLY_RETRY_DELAY_MS = 1_000;

export {
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  OUTPUT_MAX_STRUCTURED_JSON_BYTES,
} from "./output-budget.js";
