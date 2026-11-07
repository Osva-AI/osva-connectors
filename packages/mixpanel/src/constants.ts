export const CONNECTOR_KEY = "osva-connector-mixpanel";
export const CONNECTOR_NAME = "OSVA Mixpanel Connector";
export const CONNECTOR_VERSION = "0.1.0";

export const MIXPANEL_REPORT_GET_TOOL = "mixpanel.report.get";
export const MIXPANEL_SEGMENTATION_RUN_TOOL = "mixpanel.segmentation.run";
export const MIXPANEL_FUNNEL_GET_TOOL = "mixpanel.funnel.get";
export const MIXPANEL_RETENTION_RUN_TOOL = "mixpanel.retention.run";
export const MIXPANEL_COHORT_LIST_TOOL = "mixpanel.cohort.list";
export const MIXPANEL_EVENT_TOP_TOOL = "mixpanel.event.top";

export const MIXPANEL_SERVICE_ACCOUNT_USERNAME_ENV =
  "OSVA_CONNECTOR_MIXPANEL_SERVICE_ACCOUNT_USERNAME";
export const MIXPANEL_SERVICE_ACCOUNT_SECRET_ENV =
  "OSVA_CONNECTOR_MIXPANEL_SERVICE_ACCOUNT_SECRET";
export const MIXPANEL_PROJECT_ID_ENV = "OSVA_CONNECTOR_MIXPANEL_PROJECT_ID";
export const MIXPANEL_REGION_ENV = "OSVA_CONNECTOR_MIXPANEL_REGION";
export const MIXPANEL_WORKSPACE_ID_ENV = "OSVA_CONNECTOR_MIXPANEL_WORKSPACE_ID";
export const MIXPANEL_TIMEOUT_MS_ENV = "OSVA_CONNECTOR_MIXPANEL_TIMEOUT_MS";
export const MIXPANEL_ALLOWED_BOOKMARK_IDS_ENV =
  "OSVA_CONNECTOR_MIXPANEL_ALLOWED_BOOKMARK_IDS";
export const MIXPANEL_ALLOWED_FUNNEL_IDS_ENV =
  "OSVA_CONNECTOR_MIXPANEL_ALLOWED_FUNNEL_IDS";

export const MIXPANEL_QUERY_API_HOST_US = "https://mixpanel.com/api/query";
export const MIXPANEL_QUERY_API_HOST_EU = "https://eu.mixpanel.com/api/query";
export const MIXPANEL_QUERY_API_HOST_IN = "https://in.mixpanel.com/api/query";

export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
export const MIN_REQUEST_TIMEOUT_MS = 1_000;
export const MAX_REQUEST_TIMEOUT_MS = 120_000;

export const MAX_LOOKBACK_DAYS = 90;
export const MAX_DATE_STRING_LENGTH = 32;

export const MAX_EVENT_NAME_LENGTH = 255;
export const MAX_EXPRESSION_LENGTH = 2_048;
export const MAX_RESOURCE_ID_LENGTH = 64;

export const SEGMENTATION_DEFAULT_LIMIT = 100;
export const SEGMENTATION_MAX_LIMIT = 500;

export const RETENTION_DEFAULT_LIMIT = 100;
export const RETENTION_MAX_LIMIT = 500;

export const COHORT_LIST_DEFAULT_LIMIT = 100;
export const COHORT_LIST_MAX_LIMIT = 200;

export const EVENT_TOP_DEFAULT_LIMIT = 100;
export const EVENT_TOP_MAX_LIMIT = 200;

export const MAX_UNIT_LENGTH = 16;

/** Maximum raw HTTP response bytes read before JSON parsing. */
export const MAX_HTTP_RESPONSE_BYTES = 2_097_152;

/** Read-only REST: at most one retry after quota/transient 5xx. */
export const READ_ONLY_MAX_RETRIES = 1;
export const READ_ONLY_RETRY_DELAY_MS = 1_000;

export {
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  OUTPUT_MAX_STRUCTURED_JSON_BYTES,
} from "./output-budget.js";
