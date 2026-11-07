export const CONNECTOR_KEY = "osva-connector-tavily";
export const CONNECTOR_NAME = "OSVA Tavily Connector";
export const CONNECTOR_VERSION = "0.1.0";

export const TAVILY_SEARCH_TOOL = "tavily.search";
export const TAVILY_EXTRACT_TOOL = "tavily.extract";
export const TAVILY_CRAWL_TOOL = "tavily.crawl";

export const TAVILY_API_KEY_ENV = "OSVA_CONNECTOR_TAVILY_API_KEY";
export const TAVILY_TIMEOUT_MS_ENV = "OSVA_CONNECTOR_TAVILY_TIMEOUT_MS";

export const TAVILY_API_HOST = "https://api.tavily.com";

export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
export const MIN_REQUEST_TIMEOUT_MS = 1_000;
export const MAX_REQUEST_TIMEOUT_MS = 120_000;

export const SEARCH_DEFAULT_MAX_RESULTS = 5;
export const SEARCH_MAX_RESULTS = 10;

export const EXTRACT_DEFAULT_MAX_URLS = 5;
export const EXTRACT_MAX_URLS = 10;

export const CRAWL_DEFAULT_MAX_DEPTH = 1;
export const CRAWL_MAX_DEPTH = 3;
export const CRAWL_DEFAULT_LIMIT = 10;
export const CRAWL_MAX_LIMIT = 25;
export const CRAWL_DEFAULT_MAX_BREADTH = 10;
export const CRAWL_MAX_BREADTH = 20;

export const MAX_QUERY_LENGTH = 400;
export const MAX_TARGET_URL_LENGTH = 2048;
export const MAX_CRAWL_INSTRUCTIONS_LENGTH = 512;

export const MAX_HTTP_RESPONSE_BYTES = 2_097_152;

export {
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  OUTPUT_MAX_STRUCTURED_JSON_BYTES,
} from "./output-budget.js";
