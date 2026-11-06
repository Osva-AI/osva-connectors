export const CONNECTOR_KEY = "osva-connector-gmail";
export const CONNECTOR_NAME = "OSVA Gmail Connector";
export const CONNECTOR_VERSION = "0.1.0";

/** Profile */
export const GMAIL_PROFILE_GET_TOOL = "gmail.profile.get";

/** Messages and threads */
export const GMAIL_MESSAGE_LIST_TOOL = "gmail.message.list";
export const GMAIL_MESSAGE_GET_TOOL = "gmail.message.get";
export const GMAIL_THREAD_LIST_TOOL = "gmail.thread.list";
export const GMAIL_THREAD_GET_TOOL = "gmail.thread.get";

/** Labels and drafts */
export const GMAIL_LABEL_LIST_TOOL = "gmail.label.list";
export const GMAIL_DRAFT_LIST_TOOL = "gmail.draft.list";
export const GMAIL_DRAFT_CREATE_TOOL = "gmail.draft.create";
export const GMAIL_DRAFT_UPDATE_TOOL = "gmail.draft.update";

/** Sends (non-idempotent; never retried by the HTTP client) */
export const GMAIL_MESSAGE_SEND_TOOL = "gmail.message.send";

export const GMAIL_API_HOST = "https://gmail.googleapis.com/gmail/v1";

export const GMAIL_READONLY_SCOPE =
  "https://www.googleapis.com/auth/gmail.readonly";
export const GMAIL_COMPOSE_SCOPE =
  "https://www.googleapis.com/auth/gmail.compose";
export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";

export const GMAIL_TIMEOUT_MS_ENV = "OSVA_CONNECTOR_GMAIL_TIMEOUT_MS";
export const GMAIL_ACCESS_TOKEN_ENV = "OSVA_CONNECTOR_GMAIL_ACCESS_TOKEN";

/** When set, scopes are taken from this list instead of the default computed set. */
export const GMAIL_SCOPES_ENV = "OSVA_CONNECTOR_GMAIL_SCOPES";

/** Workspace domain-wide delegation — only used when explicitly enabled. */
export const GMAIL_USE_DOMAIN_DELEGATION_ENV =
  "OSVA_CONNECTOR_GMAIL_USE_DOMAIN_DELEGATION";
export const GMAIL_DELEGATED_USER_EMAIL_ENV =
  "OSVA_CONNECTOR_GMAIL_DELEGATED_USER_EMAIL";

export const GMAIL_DRAFTS_ENABLED_ENV = "OSVA_CONNECTOR_GMAIL_DRAFTS_ENABLED";
export const GMAIL_SEND_ENABLED_ENV = "OSVA_CONNECTOR_GMAIL_SEND_ENABLED";
export const GMAIL_HOST_SEND_APPROVED_ENV =
  "OSVA_CONNECTOR_GMAIL_HOST_SEND_APPROVED";

/** Comma-separated; applies To/Cc/Bcc on sends and drafts with recipients. */
export const GMAIL_ALLOWED_RECIPIENTS_ENV =
  "OSVA_CONNECTOR_GMAIL_ALLOWED_RECIPIENTS";

export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

/** Maximum raw HTTP response bytes read before parsing. */
export const MAX_HTTP_RESPONSE_BYTES = 2_097_152;

export const READ_ONLY_MAX_RETRIES = 1;
export const READ_ONLY_RETRY_DELAY_MS = 1_000;

export const LIST_DEFAULT_PAGE_SIZE = 25;
export const LIST_MAX_PAGE_SIZE = 100;

export const MAX_PAGE_TOKEN_LENGTH = 512;
export const MAX_RESOURCE_ID_LENGTH = 128;
export const MAX_QUERY_LENGTH = 512;

/** Gmail uses userId "me" internally; keep path encoding explicit in the client. */
export const GMAIL_USER_ME = "me";

export {
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  OUTPUT_MAX_STRUCTURED_JSON_BYTES,
} from "./output-budget.js";
