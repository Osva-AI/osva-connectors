export const CONNECTOR_KEY = "osva-connector-ga4";
export const CONNECTOR_NAME = "OSVA Google Analytics 4 Connector";
export const CONNECTOR_VERSION = "0.1.0";

export const GA4_PROPERTY_LIST_TOOL = "ga4.property.list";
export const GA4_PROPERTY_GET_TOOL = "ga4.property.get";
export const GA4_METADATA_GET_TOOL = "ga4.metadata.get";
export const GA4_REPORT_RUN_TOOL = "ga4.report.run";
export const GA4_REPORT_REALTIME_TOOL = "ga4.report.realtime";
export const GA4_REPORT_ACQUISITION_TOOL = "ga4.report.acquisition";
export const GA4_REPORT_ECOMMERCE_TOOL = "ga4.report.ecommerce";

export const GA4_PROPERTY_ID_ENV = "OSVA_CONNECTOR_GA4_PROPERTY_ID";
export const GA4_TIMEOUT_MS_ENV = "OSVA_CONNECTOR_GA4_TIMEOUT_MS";

export const GA4_READONLY_SCOPE =
  "https://www.googleapis.com/auth/analytics.readonly";

export const ANALYTICS_DATA_API_HOST = "https://analyticsdata.googleapis.com";
export const ANALYTICS_ADMIN_API_HOST = "https://analyticsadmin.googleapis.com";

export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
export const MIN_REQUEST_TIMEOUT_MS = 1_000;
export const MAX_REQUEST_TIMEOUT_MS = 120_000;

export const LIST_DEFAULT_LIMIT = 50;
export const LIST_MAX_LIMIT = 200;
export const MAX_PAGE_TOKEN_LENGTH = 512;

export const METADATA_DEFAULT_LIMIT = 100;
export const METADATA_MAX_LIMIT = 500;
export const METADATA_MAX_SEARCH_LENGTH = 128;

export const REPORT_DEFAULT_LIMIT = 100;
export const REPORT_MAX_LIMIT = 1_000;
export const REPORT_MAX_DIMENSIONS = 5;
export const REPORT_MAX_METRICS = 10;
export const REPORT_MAX_ORDER_BYS = 3;
export const REPORT_MAX_FILTER_VALUES = 25;
export const REPORT_MAX_DATE_RANGE_DAYS = 366;
export const REPORT_MAX_DATE_STRING_LENGTH = 32;

export const REALTIME_DEFAULT_LIMIT = 100;
export const REALTIME_MAX_LIMIT = 1_000;
export const REALTIME_MAX_DIMENSIONS = 5;
export const REALTIME_MAX_METRICS = 10;

export const MAX_DIMENSION_METRIC_NAME_LENGTH = 128;
export const MAX_PROPERTY_ID_DIGITS = 12;

/** Maximum raw HTTP response bytes read before JSON parsing. */
export const MAX_HTTP_RESPONSE_BYTES = 2_097_152;

/** Read-only REST: at most one retry after quota/transient 5xx. */
export const READ_ONLY_MAX_RETRIES = 1;
export const READ_ONLY_RETRY_DELAY_MS = 1_000;

export {
  OUTPUT_MAX_HEADER_NAME_LENGTH,
  OUTPUT_MAX_METADATA_NAME_LENGTH,
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  OUTPUT_MAX_STRUCTURED_JSON_BYTES,
} from "./output-budget.js";
