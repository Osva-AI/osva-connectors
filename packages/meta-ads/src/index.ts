export {
  createMetaAdsConnector,
  type CreateMetaAdsConnectorOptions,
} from "./connector.js";
export { loadMetaAdsConfig } from "./config.js";
export {
  CONNECTOR_KEY,
  CONNECTOR_NAME,
  CONNECTOR_VERSION,
  META_AD_ACCOUNT_LIST_TOOL,
  META_AD_ACCOUNT_GET_TOOL,
  META_CAMPAIGN_LIST_TOOL,
  META_AD_SET_LIST_TOOL,
  META_AD_LIST_TOOL,
  META_INSIGHTS_ACCOUNT_TOOL,
  META_INSIGHTS_CAMPAIGN_TOOL,
  META_INSIGHTS_AD_SET_TOOL,
  META_INSIGHTS_AD_TOOL,
  META_INSIGHTS_BREAKDOWN_TOOL,
  META_ADS_ACCESS_TOKEN_ENV,
  META_ADS_APP_SECRET_ENV,
  META_ADS_ALLOWED_ACCOUNTS_ENV,
  META_ADS_TIMEOUT_MS_ENV,
  META_ADS_MAX_ROWS_ENV,
  META_ADS_READ_SCOPE,
  OUTPUT_MAX_STRUCTURED_JSON_BYTES,
} from "./constants.js";
export type { MetaGraphClient } from "./meta-graph-client.js";
export {
  createMetaGraphClient,
  type CreateMetaGraphClientOptions,
  type MetaGraphHttpError,
} from "./meta-graph-client.js";
export { mapMetaError, type MapMetaErrorOptions } from "./map-meta-error.js";
export {
  structuredOutputByteLength,
  assertStructuredOutputWithinBudget,
} from "./output-budget.js";
export { normalizeAccountIdInput, accountIdDigits } from "./account-id.js";
export { computeAppSecretProof } from "./appsecret-proof.js";
export type { MetaAdsConfig } from "./schemas.js";
export {
  adAccountListInputSchema,
  adAccountGetInputSchema,
  campaignListInputSchema,
  adSetListInputSchema,
  adListInputSchema,
  insightsAccountInputSchema,
  insightsCampaignInputSchema,
  insightsAdSetInputSchema,
  insightsAdInputSchema,
  insightsBreakdownInputSchema,
} from "./tool-schemas.js";
