export const CONNECTOR_KEY = "osva-connector-klaviyo";
export const CONNECTOR_NAME = "OSVA Klaviyo Connector";
export const CONNECTOR_VERSION = "0.1.0";

export const KLAVIYO_ACCOUNT_GET_TOOL = "klaviyo.account.get";
export const KLAVIYO_CAMPAIGN_LIST_TOOL = "klaviyo.campaign.list";
export const KLAVIYO_CAMPAIGN_GET_TOOL = "klaviyo.campaign.get";
export const KLAVIYO_FLOW_LIST_TOOL = "klaviyo.flow.list";
export const KLAVIYO_FLOW_GET_TOOL = "klaviyo.flow.get";
export const KLAVIYO_METRIC_LIST_TOOL = "klaviyo.metric.list";
export const KLAVIYO_METRIC_GET_TOOL = "klaviyo.metric.get";
export const KLAVIYO_EVENT_LIST_TOOL = "klaviyo.event.list";
export const KLAVIYO_REPORT_CAMPAIGN_TOOL = "klaviyo.report.campaign";
export const KLAVIYO_REPORT_FLOW_TOOL = "klaviyo.report.flow";

export const KLAVIYO_PRIVATE_API_KEY_ENV =
  "OSVA_CONNECTOR_KLAVIYO_PRIVATE_API_KEY";
export const KLAVIYO_TIMEOUT_MS_ENV = "OSVA_CONNECTOR_KLAVIYO_TIMEOUT_MS";
export const KLAVIYO_MAX_ROWS_ENV = "OSVA_CONNECTOR_KLAVIYO_MAX_ROWS";

export const KLAVIYO_API_HOST = "https://a.klaviyo.com/api";
export const KLAVIYO_API_REVISION = "2026-10-15";

export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
export const MIN_REQUEST_TIMEOUT_MS = 1_000;
export const MAX_REQUEST_TIMEOUT_MS = 120_000;

export const DEFAULT_MAX_ROWS = 100;
export const MIN_MAX_ROWS = 1;
export const MAX_MAX_ROWS = 1_000;

export const LIST_DEFAULT_PAGE_SIZE = 50;
export const LIST_MAX_PAGE_SIZE = 100;
export const EVENTS_MAX_PAGE_SIZE = 200;
export const MAX_CURSOR_LENGTH = 512;
export const MAX_RESOURCE_ID_LENGTH = 64;
export const MAX_FILTER_STRING_LENGTH = 2048;

export const EVENTS_MAX_DATETIME_RANGE_DAYS = 366;

/** Sparse fieldset for GET /events (excludes event_properties and profile). */
export const EVENT_LIST_SPARSE_FIELDS = "id,datetime,timestamp,uuid";

/** Maximum raw HTTP response bytes read before JSON parsing. */
export const MAX_HTTP_RESPONSE_BYTES = 2_097_152;

/** Read-only REST: at most one retry after quota/transient 5xx. */
export const READ_ONLY_MAX_RETRIES = 1;
export const READ_ONLY_RETRY_DELAY_MS = 1_000;

/** Maximum Klaviyo pages fetched per list aggregation. */
export const MAX_PAGINATION_PAGES = 20;

export {
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  OUTPUT_MAX_STRUCTURED_JSON_BYTES,
} from "./output-budget.js";
