export const CONNECTOR_KEY = "osva-connector-google-drive";
export const CONNECTOR_NAME = "OSVA Google Drive Connector";
export const CONNECTOR_VERSION = "0.1.0";

export const DRIVE_FILE_LIST_TOOL = "drive.file.list";
export const DRIVE_FILE_GET_TOOL = "drive.file.get";
export const DRIVE_FILE_READ_TOOL = "drive.file.read";
export const DRIVE_FILE_EXPORT_TOOL = "drive.file.export";
export const DRIVE_FOLDER_LIST_TOOL = "drive.folder.list";
export const DRIVE_SHARED_DRIVE_LIST_TOOL = "drive.sharedDrive.list";
export const DRIVE_CHANGES_START_TOOL = "drive.changes.start";
export const DRIVE_CHANGES_LIST_TOOL = "drive.changes.list";

export const DRIVE_TIMEOUT_MS_ENV = "OSVA_CONNECTOR_GOOGLE_DRIVE_TIMEOUT_MS";
export const DRIVE_ALLOWED_DRIVE_IDS_ENV =
  "OSVA_CONNECTOR_GOOGLE_DRIVE_ALLOWED_DRIVE_IDS";
export const DRIVE_MAX_CONTENT_BYTES_ENV =
  "OSVA_CONNECTOR_GOOGLE_DRIVE_MAX_CONTENT_BYTES";

/**
 * Read-only Drive scope for metadata, media download, export, shared drives, and changes.
 * Restricted scope — publicly distributed OAuth clients may require Google verification.
 */
export const DRIVE_READONLY_SCOPE =
  "https://www.googleapis.com/auth/drive.readonly";

export const DRIVE_API_HOST = "https://www.googleapis.com/drive/v3";

export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
export const MIN_REQUEST_TIMEOUT_MS = 1_000;
export const MAX_REQUEST_TIMEOUT_MS = 120_000;

export const LIST_DEFAULT_PAGE_SIZE = 50;
export const LIST_MAX_PAGE_SIZE = 100;

export const MAX_DRIVE_QUERY_LENGTH = 512;
export const MAX_PAGE_TOKEN_LENGTH = 512;
export const MAX_DRIVE_ID_LENGTH = 128;
export const MAX_FILE_ID_LENGTH = 128;

export const DEFAULT_MAX_CONTENT_BYTES = 262_144;
export const MIN_MAX_CONTENT_BYTES = 1_024;
export const MAX_MAX_CONTENT_BYTES = 1_048_576;

export const DEFAULT_MAX_READ_CHARS = 32_768;
export const MAX_READ_CHARS = 131_072;

/** Maximum raw HTTP response bytes read before parsing (JSON or binary). */
export const MAX_HTTP_RESPONSE_BYTES = 2_097_152;

export const READ_ONLY_MAX_RETRIES = 1;
export const READ_ONLY_RETRY_DELAY_MS = 1_000;

export const FILE_METADATA_FIELDS =
  "id,name,mimeType,description,size,createdTime,modifiedTime,parents,webViewLink,driveId,trashed";

export const FILE_LIST_FIELDS = `nextPageToken,incompleteSearch,files(${FILE_METADATA_FIELDS})`;

export const CHANGE_FILE_FIELDS = FILE_METADATA_FIELDS;

export {
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  OUTPUT_MAX_STRUCTURED_JSON_BYTES,
} from "./output-budget.js";
