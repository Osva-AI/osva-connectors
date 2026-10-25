export const CONNECTOR_KEY = "osva-connector-gsc";
export const CONNECTOR_NAME = "OSVA Google Search Console Connector";
export const CONNECTOR_VERSION = "0.1.0";

export const GSC_PROPERTY_LIST_TOOL = "gsc.property.list";
export const GSC_PROPERTY_GET_TOOL = "gsc.property.get";
export const GSC_PERFORMANCE_QUERY_TOOL = "gsc.performance.query";
export const GSC_PERFORMANCE_PAGES_TOOL = "gsc.performance.pages";
export const GSC_PERFORMANCE_QUERIES_TOOL = "gsc.performance.queries";
export const GSC_SITEMAP_LIST_TOOL = "gsc.sitemap.list";
export const GSC_SITEMAP_GET_TOOL = "gsc.sitemap.get";
export const GSC_URL_INSPECT_TOOL = "gsc.url.inspect";

export const GSC_SITE_URL_ENV = "OSVA_CONNECTOR_GSC_SITE_URL";
export const GSC_TIMEOUT_MS_ENV = "OSVA_CONNECTOR_GSC_TIMEOUT_MS";

/** Default scope for sites, search analytics, and sitemaps. */
export const GSC_READONLY_SCOPE =
  "https://www.googleapis.com/auth/webmasters.readonly";

/**
 * URL Inspection API (`urlInspection.index.inspect`) documents OAuth scope
 * `https://www.googleapis.com/auth/webmasters` (not readonly-only).
 */
export const GSC_URL_INSPECTION_SCOPE =
  "https://www.googleapis.com/auth/webmasters";

export const WEBMASTERS_API_HOST = "https://www.googleapis.com/webmasters/v3";
export const SEARCH_CONSOLE_API_HOST =
  "https://searchconsole.googleapis.com/v1";

export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
export const MIN_REQUEST_TIMEOUT_MS = 1_000;
export const MAX_REQUEST_TIMEOUT_MS = 120_000;

export const LIST_MAX_PROPERTIES = 200;

export const ANALYTICS_DEFAULT_ROW_LIMIT = 100;
export const ANALYTICS_MAX_ROW_LIMIT = 500;
export const ANALYTICS_MAX_START_ROW = 250_000;
export const ANALYTICS_MAX_DIMENSIONS = 5;
export const ANALYTICS_MAX_DIMENSION_FILTER_GROUPS = 3;
export const ANALYTICS_MAX_FILTERS_PER_GROUP = 5;
export const ANALYTICS_MAX_DATE_STRING_LENGTH = 32;
export const ANALYTICS_MAX_REPORTING_DAYS = 487;

export const PRESET_DEFAULT_LIMIT = 100;
export const PRESET_MAX_LIMIT = 500;

export const SITEMAP_MAX_ENTRIES = 200;
export const MAX_SITEMAP_URL_LENGTH = 2048;
export const MAX_INSPECTION_URL_LENGTH = 2048;
export const MAX_LANGUAGE_CODE_LENGTH = 16;

export const MAX_SITE_URL_LENGTH = 2048;

/** Maximum raw HTTP response bytes read before JSON parsing. */
export const MAX_HTTP_RESPONSE_BYTES = 2_097_152;

/** Read-only REST: at most one retry after quota/transient 5xx. */
export const READ_ONLY_MAX_RETRIES = 1;
export const READ_ONLY_RETRY_DELAY_MS = 1_000;

export {
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  OUTPUT_MAX_STRUCTURED_JSON_BYTES,
} from "./output-budget.js";
