export { createHubspotConnector } from "./connector.js";
export type { CreateHubspotConnectorOptions } from "./connector.js";
export { loadHubspotConfig } from "./config.js";
export {
  CONNECTOR_KEY,
  CONNECTOR_NAME,
  CONNECTOR_VERSION,
  HUBSPOT_CONTACT_LIST_TOOL,
  HUBSPOT_CONTACT_GET_TOOL,
  HUBSPOT_COMPANY_LIST_TOOL,
  HUBSPOT_COMPANY_GET_TOOL,
  HUBSPOT_DEAL_LIST_TOOL,
  HUBSPOT_DEAL_GET_TOOL,
  HUBSPOT_CRM_SEARCH_TOOL,
  HUBSPOT_PIPELINE_LIST_TOOL,
  HUBSPOT_OWNER_LIST_TOOL,
  HUBSPOT_ASSOCIATION_LIST_TOOL,
  HUBSPOT_ACCESS_TOKEN_ENV,
  HUBSPOT_TIMEOUT_MS_ENV,
  HUBSPOT_MAX_ROWS_ENV,
  HUBSPOT_ALLOWED_OBJECT_TYPES_ENV,
  HUBSPOT_INCLUDE_PII_ENV,
  OUTPUT_MAX_STRUCTURED_JSON_BYTES,
} from "./constants.js";
export type { HubspotClient } from "./hubspot-client.js";
export { createHubspotRestClient } from "./hubspot-rest-client.js";
export type {
  CreateHubspotRestClientOptions,
  HubspotHttpError,
} from "./hubspot-rest-client.js";
export { mapHubspotError } from "./map-hubspot-error.js";
export {
  structuredOutputByteLength,
  assertStructuredOutputWithinBudget,
} from "./output-budget.js";
export type { HubspotConfig } from "./schemas.js";
export {
  CRM_OBJECT_TYPES,
  resolveApiProperties,
} from "./property-allowlist.js";
export { SEARCH_OPERATORS } from "./search-filter.js";
export {
  contactListInputSchema,
  contactGetInputSchema,
  crmSearchInputSchema,
  associationListInputSchema,
} from "./tool-schemas.js";
