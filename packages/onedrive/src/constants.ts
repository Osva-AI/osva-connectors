export const CONNECTOR_KEY = "osva-connector-onedrive";
export const CONNECTOR_NAME = "OSVA OneDrive Connector";
export const CONNECTOR_VERSION = "0.1.0";

export const ONEDRIVE_DRIVE_GET_TOOL = "onedrive.drive.get";
export const ONEDRIVE_ITEM_LIST_TOOL = "onedrive.item.list";
export const ONEDRIVE_ITEM_GET_TOOL = "onedrive.item.get";
export const ONEDRIVE_FILE_READ_TOOL = "onedrive.file.read";
export const ONEDRIVE_FILE_SEARCH_TOOL = "onedrive.file.search";
export const ONEDRIVE_FILE_UPLOAD_SMALL_TOOL = "onedrive.file.upload.small";

export const ONEDRIVE_ACCESS_TOKEN_ENV = "OSVA_CONNECTOR_ONEDRIVE_ACCESS_TOKEN";
export const ONEDRIVE_TIMEOUT_MS_ENV = "OSVA_CONNECTOR_ONEDRIVE_TIMEOUT_MS";
export const ONEDRIVE_ALLOWED_DRIVE_IDS_ENV =
  "OSVA_CONNECTOR_ONEDRIVE_ALLOWED_DRIVE_IDS";
export const ONEDRIVE_ALLOWED_ROOT_ITEM_IDS_ENV =
  "OSVA_CONNECTOR_ONEDRIVE_ALLOWED_ROOT_ITEM_IDS";
export const ONEDRIVE_MAX_CONTENT_BYTES_ENV =
  "OSVA_CONNECTOR_ONEDRIVE_MAX_CONTENT_BYTES";
export const ONEDRIVE_WRITE_ENABLED_ENV =
  "OSVA_CONNECTOR_ONEDRIVE_WRITE_ENABLED";
export const ONEDRIVE_HOST_WRITES_APPROVED_ENV =
  "OSVA_CONNECTOR_ONEDRIVE_HOST_WRITES_APPROVED";
export const ONEDRIVE_ALLOWED_UPLOAD_FOLDER_IDS_ENV =
  "OSVA_CONNECTOR_ONEDRIVE_ALLOWED_UPLOAD_FOLDER_IDS";

export const GRAPH_API_HOST = "https://graph.microsoft.com/v1.0";
export const PRODUCTION_GRAPH_HOSTNAME = "graph.microsoft.com";

export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
export const MIN_REQUEST_TIMEOUT_MS = 1_000;
export const MAX_REQUEST_TIMEOUT_MS = 120_000;

export const LIST_DEFAULT_PAGE_SIZE = 50;
export const LIST_MAX_PAGE_SIZE = 100;

export const MAX_ITEM_ID_LENGTH = 256;
export const MAX_DRIVE_ID_LENGTH = 128;
export const MAX_SEARCH_QUERY_LENGTH = 256;
export const MAX_FILENAME_LENGTH = 256;
export const MAX_NEXT_LINK_LENGTH = 4_096;

export const DEFAULT_MAX_CONTENT_BYTES = 262_144;
export const MIN_MAX_CONTENT_BYTES = 1_024;
export const MAX_MAX_CONTENT_BYTES = 1_048_576;

/** Conservative small-upload body cap (PUT content). */
export const DEFAULT_SMALL_UPLOAD_MAX_BYTES = 262_144;

export const DEFAULT_MAX_READ_CHARS = 32_768;
export const MAX_READ_CHARS = 131_072;

export const MAX_HTTP_RESPONSE_BYTES = 2_097_152;
export const READ_ONLY_MAX_RETRIES = 1;
export const READ_ONLY_RETRY_DELAY_MS = 1_000;

export const MAX_PARENT_WALK_DEPTH = 32;

export {
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  OUTPUT_MAX_STRUCTURED_JSON_BYTES,
} from "./output-budget.js";
