export const CONNECTOR_KEY = "osva-connector-google-calendar";
export const CONNECTOR_NAME = "OSVA Google Calendar Connector";
export const CONNECTOR_VERSION = "0.1.0";

export const CAL_CALENDAR_LIST_TOOL = "calendar.calendar.list";
export const CAL_EVENT_LIST_TOOL = "calendar.event.list";
export const CAL_EVENT_GET_TOOL = "calendar.event.get";
export const CAL_FREEBUSY_QUERY_TOOL = "calendar.freebusy.query";

export const CAL_EVENT_CREATE_TOOL = "calendar.event.create";
export const CAL_EVENT_UPDATE_TOOL = "calendar.event.update";
export const CAL_EVENT_DELETE_TOOL = "calendar.event.delete";

export const CALENDAR_API_HOST = "https://www.googleapis.com/calendar/v3";

export const CALENDAR_READONLY_SCOPE =
  "https://www.googleapis.com/auth/calendar.readonly";
export const CALENDAR_EVENTS_SCOPE =
  "https://www.googleapis.com/auth/calendar.events";

export const CAL_TIMEOUT_MS_ENV = "OSVA_CONNECTOR_GOOGLE_CALENDAR_TIMEOUT_MS";
export const CAL_ACCESS_TOKEN_ENV =
  "OSVA_CONNECTOR_GOOGLE_CALENDAR_ACCESS_TOKEN";
export const CAL_SCOPES_ENV = "OSVA_CONNECTOR_GOOGLE_CALENDAR_SCOPES";

export const CAL_USE_DOMAIN_DELEGATION_ENV =
  "OSVA_CONNECTOR_GOOGLE_CALENDAR_USE_DOMAIN_DELEGATION";
export const CAL_DELEGATED_USER_EMAIL_ENV =
  "OSVA_CONNECTOR_GOOGLE_CALENDAR_DELEGATED_USER_EMAIL";

export const CAL_WRITE_ENABLED_ENV =
  "OSVA_CONNECTOR_GOOGLE_CALENDAR_WRITE_ENABLED";
export const CAL_HOST_MUTATIONS_APPROVED_ENV =
  "OSVA_CONNECTOR_GOOGLE_CALENDAR_HOST_MUTATIONS_APPROVED";

/**
 * Comma-separated calendar IDs for allowlist enforcement (e.g. `primary`, `x@group.calendar.google.com`).
 * Absent = no allowlist (reads unrestricted by connector). Empty / whitespace-only = explicit deny-all.
 */
export const CAL_ALLOWED_CALENDARS_ENV =
  "OSVA_CONNECTOR_GOOGLE_CALENDAR_ALLOWED_CALENDAR_IDS";

export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

export const MAX_HTTP_RESPONSE_BYTES = 2_097_152;

export const READ_ONLY_MAX_RETRIES = 1;
export const READ_ONLY_RETRY_DELAY_MS = 1_000;

export const LIST_DEFAULT_PAGE_SIZE = 25;
export const LIST_MAX_PAGE_SIZE = 250;

export const MAX_PAGE_TOKEN_LENGTH = 512;
export const MAX_RESOURCE_ID_LENGTH = 1024;
export const MAX_CALENDAR_ID_LENGTH = 1024;
export const MAX_TIME_MAX_LENGTH = 64;
export const MAX_FREEBUSY_ITEMS = 50;

export {
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  OUTPUT_MAX_STRUCTURED_JSON_BYTES,
} from "./output-budget.js";
