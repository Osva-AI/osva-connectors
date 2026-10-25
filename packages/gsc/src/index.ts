export { createGscConnector } from "./connector.js";
export type { CreateGscConnectorOptions } from "./connector.js";
export { loadGscConfig } from "./config.js";
export {
  createGoogleAuthTokenProvider,
  createStaticBearerTokenProvider,
} from "./gsc-auth.js";
export type { GscTokenProvider } from "./gsc-auth.js";
export {
  CONNECTOR_KEY,
  CONNECTOR_NAME,
  CONNECTOR_VERSION,
  GSC_PERFORMANCE_PAGES_TOOL,
  GSC_PERFORMANCE_QUERIES_TOOL,
  GSC_PERFORMANCE_QUERY_TOOL,
  GSC_PROPERTY_GET_TOOL,
  GSC_PROPERTY_LIST_TOOL,
  GSC_SITEMAP_GET_TOOL,
  GSC_SITEMAP_LIST_TOOL,
  GSC_URL_INSPECT_TOOL,
  GSC_SITE_URL_ENV,
  GSC_TIMEOUT_MS_ENV,
  GSC_READONLY_SCOPE,
  GSC_URL_INSPECTION_SCOPE,
  OUTPUT_MAX_STRUCTURED_JSON_BYTES,
} from "./constants.js";
export type { GscClient } from "./gsc-client.js";
export { createGscRestClient } from "./gsc-rest-client.js";
export type { CreateGscRestClientOptions } from "./gsc-rest-client.js";
export { mapGscError } from "./map-gsc-error.js";
export {
  structuredOutputByteLength,
  assertStructuredOutputWithinBudget,
} from "./output-budget.js";
export {
  propertyListInputSchema,
  propertyGetInputSchema,
  performanceQueryInputSchema,
  performancePagesInputSchema,
  performanceQueriesInputSchema,
  sitemapListInputSchema,
  sitemapGetInputSchema,
  urlInspectInputSchema,
} from "./tool-schemas.js";
export type { GscConfig } from "./schemas.js";
export { SEARCH_ANALYTICS_REPORTING_NOTES } from "./normalize-analytics.js";
