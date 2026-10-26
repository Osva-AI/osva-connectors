export const CONNECTOR_KEY = "osva-connector-google-sheets";
export const CONNECTOR_NAME = "OSVA Google Sheets Connector";
export const CONNECTOR_VERSION = "0.1.0";

export const SHEETS_SPREADSHEET_GET_TOOL = "sheets.spreadsheet.get";
export const SHEETS_SHEET_LIST_TOOL = "sheets.sheet.list";
export const SHEETS_VALUES_GET_TOOL = "sheets.values.get";
export const SHEETS_VALUES_BATCH_GET_TOOL = "sheets.values.batchGet";
export const SHEETS_VALUES_APPEND_TOOL = "sheets.values.append";
export const SHEETS_VALUES_UPDATE_TOOL = "sheets.values.update";
export const SHEETS_VALUES_BATCH_UPDATE_TOOL = "sheets.values.batchUpdate";
export const SHEETS_SHEET_ADD_TOOL = "sheets.sheet.add";

export const SHEETS_WRITE_ENABLED_ENV =
  "OSVA_CONNECTOR_GOOGLE_SHEETS_WRITE_ENABLED";
export const SHEETS_TIMEOUT_MS_ENV = "OSVA_CONNECTOR_GOOGLE_SHEETS_TIMEOUT_MS";
export const SHEETS_ALLOWED_SPREADSHEETS_ENV =
  "OSVA_CONNECTOR_GOOGLE_SHEETS_ALLOWED_SPREADSHEETS";

export const SHEETS_READONLY_SCOPE =
  "https://www.googleapis.com/auth/spreadsheets.readonly";
export const SHEETS_FULL_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

export const SHEETS_API_HOST = "https://sheets.googleapis.com/v4";

export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
export const MIN_REQUEST_TIMEOUT_MS = 1_000;
export const MAX_REQUEST_TIMEOUT_MS = 120_000;

export const MAX_SPREADSHEET_ID_LENGTH = 128;
export const SPREADSHEET_ID_PATTERN = /^[a-zA-Z0-9-_]+$/;

export const MAX_A1_RANGE_LENGTH = 512;
export const MAX_SHEET_TITLE_LENGTH = 100;
export const MAX_SHEET_ROW_DIMENSION = 10_000;
export const MAX_SHEET_COLUMN_DIMENSION = 1_024;

export const VALUE_RENDER_OPTIONS = [
  "FORMATTED_VALUE",
  "UNFORMATTED_VALUE",
  "FORMULA",
] as const;
export type ValueRenderOption = (typeof VALUE_RENDER_OPTIONS)[number];
export const MAX_BATCH_RANGES = 32;
export const MAX_VALUE_ROWS = 1_000;
export const MAX_VALUE_COLUMNS = 100;
export const MAX_CELL_STRING_LENGTH = 50_000;

/** Maximum raw HTTP response bytes read before parsing. */
export const MAX_HTTP_RESPONSE_BYTES = 2_097_152;

export const READ_ONLY_MAX_RETRIES = 1;
export const READ_ONLY_RETRY_DELAY_MS = 1_000;

export {
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  OUTPUT_MAX_STRUCTURED_JSON_BYTES,
} from "./output-budget.js";
