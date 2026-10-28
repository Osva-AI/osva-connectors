export const CONNECTOR_KEY = "osva-connector-hubspot";
export const CONNECTOR_NAME = "OSVA HubSpot Connector";
export const CONNECTOR_VERSION = "0.1.0";

export const HUBSPOT_CONTACT_LIST_TOOL = "hubspot.contact.list";
export const HUBSPOT_CONTACT_GET_TOOL = "hubspot.contact.get";
export const HUBSPOT_COMPANY_LIST_TOOL = "hubspot.company.list";
export const HUBSPOT_COMPANY_GET_TOOL = "hubspot.company.get";
export const HUBSPOT_DEAL_LIST_TOOL = "hubspot.deal.list";
export const HUBSPOT_DEAL_GET_TOOL = "hubspot.deal.get";
export const HUBSPOT_CRM_SEARCH_TOOL = "hubspot.crm.search";
export const HUBSPOT_PIPELINE_LIST_TOOL = "hubspot.pipeline.list";
export const HUBSPOT_OWNER_LIST_TOOL = "hubspot.owner.list";
export const HUBSPOT_ASSOCIATION_LIST_TOOL = "hubspot.association.list";

export const HUBSPOT_ACCESS_TOKEN_ENV = "OSVA_CONNECTOR_HUBSPOT_ACCESS_TOKEN";
export const HUBSPOT_TIMEOUT_MS_ENV = "OSVA_CONNECTOR_HUBSPOT_TIMEOUT_MS";
export const HUBSPOT_MAX_ROWS_ENV = "OSVA_CONNECTOR_HUBSPOT_MAX_ROWS";
export const HUBSPOT_ALLOWED_OBJECT_TYPES_ENV =
  "OSVA_CONNECTOR_HUBSPOT_ALLOWED_OBJECT_TYPES";
export const HUBSPOT_INCLUDE_PII_ENV = "OSVA_CONNECTOR_HUBSPOT_INCLUDE_PII";

export const HUBSPOT_API_HOST = "https://api.hubapi.com";
export const HUBSPOT_API_VERSION = "2026-09";

export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
export const MIN_REQUEST_TIMEOUT_MS = 1_000;
export const MAX_REQUEST_TIMEOUT_MS = 120_000;

export const DEFAULT_MAX_ROWS = 100;
export const MIN_MAX_ROWS = 1;
export const MAX_MAX_ROWS = 1_000;

export const LIST_DEFAULT_PAGE_SIZE = 50;
export const LIST_MAX_PAGE_SIZE = 100;
export const MAX_CURSOR_LENGTH = 512;
export const MAX_RESOURCE_ID_LENGTH = 32;

export const MAX_SEARCH_FILTER_GROUPS = 5;
export const MAX_FILTERS_PER_GROUP = 6;

/** Maximum raw HTTP response bytes read before JSON parsing. */
export const MAX_HTTP_RESPONSE_BYTES = 2_097_152;

/** Read-only REST: at most one retry after quota/transient 5xx. */
export const READ_ONLY_MAX_RETRIES = 1;
export const READ_ONLY_RETRY_DELAY_MS = 1_000;

/** Maximum HubSpot pages fetched per list aggregation. */
export const MAX_PAGINATION_PAGES = 20;

export {
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  OUTPUT_MAX_STRUCTURED_JSON_BYTES,
} from "./output-budget.js";
