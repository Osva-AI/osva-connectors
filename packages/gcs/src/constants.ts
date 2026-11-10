export const CONNECTOR_KEY = "osva-connector-gcs";
export const CONNECTOR_NAME = "OSVA Google Cloud Storage Connector";
export const CONNECTOR_VERSION = "0.1.1";

export const GCS_BUCKET_LIST_TOOL = "gcs.bucket.list";
export const GCS_BUCKET_GET_TOOL = "gcs.bucket.get";
export const GCS_OBJECT_LIST_TOOL = "gcs.object.list";
export const GCS_OBJECT_METADATA_GET_TOOL = "gcs.object.metadata.get";
export const GCS_OBJECT_TEXT_READ_TOOL = "gcs.object.text.read";
export const GCS_OBJECT_VERSIONS_LIST_TOOL = "gcs.object.versions.list";
export const GCS_OBJECT_TEXT_CREATE_TOOL = "gcs.object.text.create";
export const GCS_OBJECT_TEXT_REPLACE_TOOL = "gcs.object.text.replace";

export const GCS_PROJECT_ID_ENV = "OSVA_CONNECTOR_GCS_PROJECT_ID";
export const GCS_TIMEOUT_MS_ENV = "OSVA_CONNECTOR_GCS_TIMEOUT_MS";
export const GCS_ALLOWED_BUCKETS_READ_ENV =
  "OSVA_CONNECTOR_GCS_ALLOWED_BUCKETS_READ";
export const GCS_ALLOWED_BUCKETS_WRITE_ENV =
  "OSVA_CONNECTOR_GCS_ALLOWED_BUCKETS_WRITE";
export const GCS_CREATE_ENABLED_ENV = "OSVA_CONNECTOR_GCS_CREATE_ENABLED";
export const GCS_REPLACE_ENABLED_ENV = "OSVA_CONNECTOR_GCS_REPLACE_ENABLED";
export const GCS_HOST_WRITES_APPROVED_ENV =
  "OSVA_CONNECTOR_GCS_HOST_WRITES_APPROVED";
export const GCS_ACCOUNT_WIDE_BUCKET_DISCOVERY_ENV =
  "OSVA_CONNECTOR_GCS_ACCOUNT_WIDE_BUCKET_DISCOVERY";

export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
export const MIN_REQUEST_TIMEOUT_MS = 1_000;
export const MAX_REQUEST_TIMEOUT_MS = 120_000;

export const LIST_DEFAULT_PAGE_SIZE = 20;
export const LIST_MAX_PAGE_SIZE = 50;

export const MAX_BUCKET_NAME_LENGTH = 63;
export const MAX_OBJECT_KEY_LENGTH = 1024;
export const MAX_SEARCH_PREFIX_LENGTH = 512;
export const MAX_CONTINUATION_TOKEN_LENGTH = 256;
export const MAX_CONTINUATION_STORE_ENTRIES = 2_048;
export const DEFAULT_CONTINUATION_TTL_MS = 15 * 60 * 1000;
export const MAX_GENERATION_LENGTH = 32;

export const MAX_CONTENT_BYTES = 65_536;

export const READ_ONLY_MAX_RETRIES = 1;
