export const CONNECTOR_KEY = "osva-connector-aws-s3";
export const CONNECTOR_NAME = "OSVA AWS S3 Connector";
export const CONNECTOR_VERSION = "0.1.1";

export const S3_BUCKET_LIST_TOOL = "s3.bucket.list";
export const S3_BUCKET_GET_TOOL = "s3.bucket.get";
export const S3_OBJECT_LIST_TOOL = "s3.object.list";
export const S3_OBJECT_METADATA_GET_TOOL = "s3.object.metadata.get";
export const S3_OBJECT_TEXT_READ_TOOL = "s3.object.text.read";
export const S3_OBJECT_VERSIONS_LIST_TOOL = "s3.object.versions.list";
export const S3_OBJECT_TEXT_CREATE_TOOL = "s3.object.text.create";
export const S3_OBJECT_TEXT_REPLACE_TOOL = "s3.object.text.replace";

export const S3_REGION_ENV = "OSVA_CONNECTOR_S3_REGION";
export const S3_TIMEOUT_MS_ENV = "OSVA_CONNECTOR_S3_TIMEOUT_MS";
export const S3_ALLOWED_BUCKETS_READ_ENV =
  "OSVA_CONNECTOR_S3_ALLOWED_BUCKETS_READ";
export const S3_ALLOWED_BUCKETS_WRITE_ENV =
  "OSVA_CONNECTOR_S3_ALLOWED_BUCKETS_WRITE";
export const S3_CREATE_ENABLED_ENV = "OSVA_CONNECTOR_S3_CREATE_ENABLED";
export const S3_REPLACE_ENABLED_ENV = "OSVA_CONNECTOR_S3_REPLACE_ENABLED";
export const S3_HOST_WRITES_APPROVED_ENV =
  "OSVA_CONNECTOR_S3_HOST_WRITES_APPROVED";
export const S3_ACCOUNT_WIDE_BUCKET_DISCOVERY_ENV =
  "OSVA_CONNECTOR_S3_ACCOUNT_WIDE_BUCKET_DISCOVERY";

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
export const MAX_ETAG_LENGTH = 128;

export const MAX_CONTENT_BYTES = 65_536;

export const READ_ONLY_MAX_RETRIES = 1;
