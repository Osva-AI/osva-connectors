export const CONNECTOR_KEY = "osva-connector-amplitude";
export const CONNECTOR_NAME = "OSVA Amplitude Connector";
export const CONNECTOR_VERSION = "0.1.0";

export const AMPLITUDE_EVENT_LIST_TOOL = "amplitude.event.list";
export const AMPLITUDE_EVENT_SEGMENTATION_TOOL = "amplitude.event.segmentation";
export const AMPLITUDE_FUNNEL_RUN_TOOL = "amplitude.funnel.run";
export const AMPLITUDE_RETENTION_RUN_TOOL = "amplitude.retention.run";
export const AMPLITUDE_USER_ACTIVE_TOOL = "amplitude.user.active";
export const AMPLITUDE_CHART_GET_TOOL = "amplitude.chart.get";
export const AMPLITUDE_SESSION_AVERAGE_TOOL = "amplitude.session.average";

export const AMPLITUDE_API_KEY_ENV = "OSVA_CONNECTOR_AMPLITUDE_API_KEY";
export const AMPLITUDE_SECRET_KEY_ENV = "OSVA_CONNECTOR_AMPLITUDE_SECRET_KEY";
export const AMPLITUDE_REGION_ENV = "OSVA_CONNECTOR_AMPLITUDE_REGION";
export const AMPLITUDE_TIMEOUT_MS_ENV = "OSVA_CONNECTOR_AMPLITUDE_TIMEOUT_MS";
export const AMPLITUDE_ALLOWED_CHART_IDS_ENV =
  "OSVA_CONNECTOR_AMPLITUDE_ALLOWED_CHART_IDS";

export const AMPLITUDE_API_HOST_US = "https://amplitude.com";
export const AMPLITUDE_API_HOST_EU = "https://analytics.eu.amplitude.com";

export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
export const MIN_REQUEST_TIMEOUT_MS = 1_000;
export const MAX_REQUEST_TIMEOUT_MS = 120_000;

export const MAX_LOOKBACK_DAYS = 90;
export const MAX_FUNNEL_EVENTS = 5;
export const MAX_GROUP_BY_PROPERTIES = 2;
export const MAX_EVENT_TYPE_LENGTH = 256;
export const MAX_CHART_ID_LENGTH = 64;
export const MAX_SEGMENT_PARAM_LENGTH = 4096;

/** Maximum raw HTTP response bytes read before JSON parsing. */
export const MAX_HTTP_RESPONSE_BYTES = 2_097_152;

/** Read-only REST: at most one retry after quota/transient 5xx. */
export const READ_ONLY_MAX_RETRIES = 1;
export const READ_ONLY_RETRY_DELAY_MS = 1_000;

export {
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  OUTPUT_MAX_STRUCTURED_JSON_BYTES,
} from "./output-budget.js";
