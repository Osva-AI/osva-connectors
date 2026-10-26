export {
  createGoogleAdsConnector,
  type CreateGoogleAdsConnectorOptions,
} from "./connector.js";
export { loadGoogleAdsConfig } from "./config.js";
export {
  createGoogleAuthTokenProvider,
  createStaticBearerTokenProvider,
  type GoogleAdsTokenProvider,
} from "./google-ads-auth.js";
export {
  CONNECTOR_KEY,
  CONNECTOR_NAME,
  CONNECTOR_VERSION,
  ADS_CUSTOMER_LIST_TOOL,
  ADS_CUSTOMER_GET_TOOL,
  ADS_CAMPAIGN_LIST_TOOL,
  ADS_CAMPAIGN_PERFORMANCE_TOOL,
  ADS_AD_GROUP_PERFORMANCE_TOOL,
  ADS_KEYWORD_PERFORMANCE_TOOL,
  ADS_SEARCH_TERM_PERFORMANCE_TOOL,
  ADS_ASSET_PERFORMANCE_TOOL,
  ADS_REPORT_QUERY_TOOL,
  GOOGLE_ADS_LOGIN_CUSTOMER_ID_ENV,
  GOOGLE_ADS_ALLOWED_CUSTOMERS_ENV,
  GOOGLE_ADS_TIMEOUT_MS_ENV,
  GOOGLE_ADS_MAX_ROWS_ENV,
  GOOGLE_ADS_DEVELOPER_TOKEN_ENV,
  GOOGLE_ADS_SCOPE,
  OUTPUT_MAX_STRUCTURED_JSON_BYTES,
} from "./constants.js";
export type {
  GoogleAdsClient,
  GoogleAdsSearchParams,
} from "./google-ads-client.js";
export {
  createGoogleAdsRestClient,
  type CreateGoogleAdsRestClientOptions,
  type GoogleAdsHttpError,
} from "./google-ads-rest-client.js";
export {
  mapGoogleAdsError,
  type MapGoogleAdsErrorOptions,
} from "./map-google-ads-error.js";
export {
  structuredOutputByteLength,
  assertStructuredOutputWithinBudget,
} from "./output-budget.js";
export { validateGaqlSelectQuery } from "./gaql-validator.js";
export { parseCustomerId, normalizeCustomerIdInput } from "./customer-id.js";
export type { GoogleAdsConfig } from "./schemas.js";
export {
  customerListInputSchema,
  customerGetInputSchema,
  campaignListInputSchema,
  campaignPerformanceInputSchema,
  adGroupPerformanceInputSchema,
  keywordPerformanceInputSchema,
  searchTermPerformanceInputSchema,
  assetPerformanceInputSchema,
  reportQueryInputSchema,
} from "./tool-schemas.js";
