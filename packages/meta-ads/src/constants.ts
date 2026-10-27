export const CONNECTOR_KEY = "osva-connector-meta-ads";
export const CONNECTOR_NAME = "OSVA Meta Ads Connector";
export const CONNECTOR_VERSION = "0.1.0";

export const META_AD_ACCOUNT_LIST_TOOL = "meta.adAccount.list";
export const META_AD_ACCOUNT_GET_TOOL = "meta.adAccount.get";
export const META_CAMPAIGN_LIST_TOOL = "meta.campaign.list";
export const META_AD_SET_LIST_TOOL = "meta.adSet.list";
export const META_AD_LIST_TOOL = "meta.ad.list";
export const META_INSIGHTS_ACCOUNT_TOOL = "meta.insights.account";
export const META_INSIGHTS_CAMPAIGN_TOOL = "meta.insights.campaign";
export const META_INSIGHTS_AD_SET_TOOL = "meta.insights.adSet";
export const META_INSIGHTS_AD_TOOL = "meta.insights.ad";
export const META_INSIGHTS_BREAKDOWN_TOOL = "meta.insights.breakdown";

export const META_ADS_ACCESS_TOKEN_ENV = "OSVA_CONNECTOR_META_ADS_ACCESS_TOKEN";
export const META_ADS_APP_SECRET_ENV = "OSVA_CONNECTOR_META_ADS_APP_SECRET";
export const META_ADS_ALLOWED_ACCOUNTS_ENV =
  "OSVA_CONNECTOR_META_ADS_ALLOWED_ACCOUNTS";
export const META_ADS_TIMEOUT_MS_ENV = "OSVA_CONNECTOR_META_ADS_TIMEOUT_MS";
export const META_ADS_MAX_ROWS_ENV = "OSVA_CONNECTOR_META_ADS_MAX_ROWS";

/** Primary read scope for Marketing API structure and insights. */
export const META_ADS_READ_SCOPE = "ads_read";

export const META_GRAPH_API_HOST = "https://graph.facebook.com";
export const META_GRAPH_API_VERSION = "v26.0";

export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
export const MIN_REQUEST_TIMEOUT_MS = 1_000;
export const MAX_REQUEST_TIMEOUT_MS = 120_000;

export const DEFAULT_MAX_ROWS = 100;
export const MIN_MAX_ROWS = 1;
export const MAX_MAX_ROWS = 1_000;

export const LIST_DEFAULT_LIMIT = 25;
export const LIST_MAX_LIMIT = 100;
export const MAX_CURSOR_LENGTH = 512;

export const INSIGHTS_MAX_DATE_RANGE_DAYS = 366;
export const MAX_ACCOUNT_ID_DIGITS = 20;

/** Maximum raw HTTP response bytes read before JSON parsing. */
export const MAX_HTTP_RESPONSE_BYTES = 2_097_152;

/** Read-only REST: at most one retry after quota/transient 5xx. */
export const READ_ONLY_MAX_RETRIES = 1;
export const READ_ONLY_RETRY_DELAY_MS = 1_000;

/** Maximum Graph API pages fetched per list/insights aggregation. */
export const MAX_PAGINATION_PAGES = 20;

export const GRAPH_DEFAULT_PAGE_SIZE = 25;
export const GRAPH_MAX_PAGE_SIZE = 100;

export {
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  OUTPUT_MAX_STRUCTURED_JSON_BYTES,
} from "./output-budget.js";
