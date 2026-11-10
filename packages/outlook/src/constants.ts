export const CONNECTOR_KEY = "osva-connector-outlook";
export const CONNECTOR_NAME = "OSVA Outlook Connector";
export const CONNECTOR_VERSION = "0.1.1";

export const OUTLOOK_MAIL_FOLDER_LIST_TOOL = "outlook.mailFolder.list";
export const OUTLOOK_MESSAGE_LIST_TOOL = "outlook.message.list";
export const OUTLOOK_MESSAGE_GET_TOOL = "outlook.message.get";
export const OUTLOOK_MESSAGE_SEARCH_TOOL = "outlook.message.search";
export const OUTLOOK_CALENDAR_LIST_TOOL = "outlook.calendar.list";
export const OUTLOOK_EVENT_LIST_TOOL = "outlook.event.list";
export const OUTLOOK_EVENT_GET_TOOL = "outlook.event.get";
export const OUTLOOK_MESSAGE_SEND_TOOL = "outlook.message.send";
export const OUTLOOK_EVENT_CREATE_TOOL = "outlook.event.create";

export const GRAPH_API_HOST = "https://graph.microsoft.com/v1.0";

export const OUTLOOK_ACCESS_TOKEN_ENV = "OSVA_CONNECTOR_OUTLOOK_ACCESS_TOKEN";
export const OUTLOOK_TIMEOUT_MS_ENV = "OSVA_CONNECTOR_OUTLOOK_TIMEOUT_MS";
export const OUTLOOK_ALLOWED_MAIL_FOLDER_IDS_ENV =
  "OSVA_CONNECTOR_OUTLOOK_ALLOWED_MAIL_FOLDER_IDS";
export const OUTLOOK_ALLOWED_CALENDAR_IDS_ENV =
  "OSVA_CONNECTOR_OUTLOOK_ALLOWED_CALENDAR_IDS";
export const OUTLOOK_SEND_ENABLED_ENV = "OSVA_CONNECTOR_OUTLOOK_SEND_ENABLED";
export const OUTLOOK_HOST_SEND_APPROVED_ENV =
  "OSVA_CONNECTOR_OUTLOOK_HOST_SEND_APPROVED";
export const OUTLOOK_ALLOWED_RECIPIENTS_ENV =
  "OSVA_CONNECTOR_OUTLOOK_ALLOWED_RECIPIENTS";
export const OUTLOOK_WRITE_ENABLED_ENV = "OSVA_CONNECTOR_OUTLOOK_WRITE_ENABLED";
export const OUTLOOK_HOST_WRITES_APPROVED_ENV =
  "OSVA_CONNECTOR_OUTLOOK_HOST_WRITES_APPROVED";

export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
export const MIN_REQUEST_TIMEOUT_MS = 1_000;
export const MAX_REQUEST_TIMEOUT_MS = 120_000;

export const LIST_DEFAULT_PAGE_SIZE = 25;
export const LIST_MAX_PAGE_SIZE = 100;

export const MAX_NEXT_LINK_LENGTH = 4_096;
export const MAX_GRAPH_ID_LENGTH = 512;
export const MAX_SEARCH_QUERY_LENGTH = 256;

export const MAX_HTTP_RESPONSE_BYTES = 2_097_152;
export const READ_ONLY_MAX_RETRIES = 1;
export const READ_ONLY_RETRY_DELAY_MS = 1_000;

export {
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  OUTPUT_MAX_STRUCTURED_JSON_BYTES,
} from "./output-budget.js";
