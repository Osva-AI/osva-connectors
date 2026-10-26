export const CONNECTOR_KEY = "osva-connector-google-ads";
export const CONNECTOR_NAME = "OSVA Google Ads Connector";
export const CONNECTOR_VERSION = "0.1.0";

export const ADS_CUSTOMER_LIST_TOOL = "ads.customer.list";
export const ADS_CUSTOMER_GET_TOOL = "ads.customer.get";
export const ADS_CAMPAIGN_LIST_TOOL = "ads.campaign.list";
export const ADS_CAMPAIGN_PERFORMANCE_TOOL = "ads.campaign.performance";
export const ADS_AD_GROUP_PERFORMANCE_TOOL = "ads.adGroup.performance";
export const ADS_KEYWORD_PERFORMANCE_TOOL = "ads.keyword.performance";
export const ADS_SEARCH_TERM_PERFORMANCE_TOOL = "ads.searchTerm.performance";
export const ADS_ASSET_PERFORMANCE_TOOL = "ads.asset.performance";
export const ADS_REPORT_QUERY_TOOL = "ads.report.query";

export const GOOGLE_ADS_LOGIN_CUSTOMER_ID_ENV =
  "OSVA_CONNECTOR_GOOGLE_ADS_LOGIN_CUSTOMER_ID";
export const GOOGLE_ADS_ALLOWED_CUSTOMERS_ENV =
  "OSVA_CONNECTOR_GOOGLE_ADS_ALLOWED_CUSTOMERS";
export const GOOGLE_ADS_TIMEOUT_MS_ENV = "OSVA_CONNECTOR_GOOGLE_ADS_TIMEOUT_MS";
export const GOOGLE_ADS_MAX_ROWS_ENV = "OSVA_CONNECTOR_GOOGLE_ADS_MAX_ROWS";
export const GOOGLE_ADS_DEVELOPER_TOKEN_ENV =
  "OSVA_CONNECTOR_GOOGLE_ADS_DEVELOPER_TOKEN";

export const GOOGLE_ADS_SCOPE = "https://www.googleapis.com/auth/adwords";

export const GOOGLE_ADS_API_HOST = "https://googleads.googleapis.com";
export const GOOGLE_ADS_API_VERSION = "v26";

export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
export const MIN_REQUEST_TIMEOUT_MS = 1_000;
export const MAX_REQUEST_TIMEOUT_MS = 120_000;

export const DEFAULT_MAX_ROWS = 100;
export const MIN_MAX_ROWS = 1;
export const MAX_MAX_ROWS = 1_000;

export const LIST_DEFAULT_LIMIT = 50;
export const LIST_MAX_LIMIT = 200;
export const MAX_PAGE_TOKEN_LENGTH = 512;

export const REPORT_MAX_DATE_RANGE_DAYS = 366;
export const MAX_CUSTOMER_ID_DIGITS = 10;

/** Maximum raw HTTP response bytes read before JSON parsing. */
export const MAX_HTTP_RESPONSE_BYTES = 2_097_152;

/** Read-only REST: at most one retry after quota/transient 5xx. */
export const READ_ONLY_MAX_RETRIES = 1;
export const READ_ONLY_RETRY_DELAY_MS = 1_000;

/** Google Ads Search default page size cap for connector pagination. */
export const SEARCH_DEFAULT_PAGE_SIZE = 100;
export const SEARCH_MAX_PAGE_SIZE = 1_000;

export {
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  OUTPUT_MAX_STRUCTURED_JSON_BYTES,
} from "./output-budget.js";
