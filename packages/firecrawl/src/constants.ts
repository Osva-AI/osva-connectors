export const CONNECTOR_KEY = "osva-connector-firecrawl";
export const CONNECTOR_NAME = "OSVA Firecrawl Connector";
export const CONNECTOR_VERSION = "0.1.1";

export const FIRECRAWL_SCRAPE_TOOL = "firecrawl.scrape";
export const FIRECRAWL_SEARCH_TOOL = "firecrawl.search";
export const FIRECRAWL_MAP_TOOL = "firecrawl.map";
export const FIRECRAWL_CRAWL_START_TOOL = "firecrawl.crawl.start";
export const FIRECRAWL_CRAWL_STATUS_TOOL = "firecrawl.crawl.status";

export const FIRECRAWL_API_KEY_ENV = "OSVA_CONNECTOR_FIRECRAWL_API_KEY";
export const FIRECRAWL_TIMEOUT_MS_ENV = "OSVA_CONNECTOR_FIRECRAWL_TIMEOUT_MS";

export const FIRECRAWL_API_HOST = "https://api.firecrawl.dev/v2";

export const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;
export const MIN_REQUEST_TIMEOUT_MS = 1_000;
export const MAX_REQUEST_TIMEOUT_MS = 180_000;

export const MAX_HTTP_URL_LENGTH = 2048;
export const MAX_SEARCH_QUERY_LENGTH = 500;
export const MAX_MAP_SEARCH_FILTER_LENGTH = 256;

export const SEARCH_DEFAULT_LIMIT = 5;
export const SEARCH_MAX_LIMIT = 20;

export const MAP_DEFAULT_LIMIT = 100;
export const MAP_MAX_LIMIT = 500;

export const CRAWL_DEFAULT_LIMIT = 10;
export const CRAWL_MAX_LIMIT = 100;
export const CRAWL_DEFAULT_MAX_DISCOVERY_DEPTH = 2;
export const CRAWL_MAX_DISCOVERY_DEPTH = 10;

export const MAX_SCRAPE_MARKDOWN_CODEPOINTS = 32_768;
export const MAX_CRAWL_ITEM_MARKDOWN_CODEPOINTS = 8_192;
export const MAX_CRAWL_STATUS_DATA_ITEMS = 50;

export const MAX_CRAWL_ID_LENGTH = 64;
export const MAX_PAGINATION_NEXT_URL_LENGTH = 4096;
export const MAX_CRAWL_STATUS_SKIP = 10_000;

export const MAX_HTTP_RESPONSE_BYTES = 2_097_152;
export const READ_ONLY_MAX_RETRIES = 1;
export const READ_ONLY_RETRY_DELAY_MS = 1_000;

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export {
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  OUTPUT_MAX_STRUCTURED_JSON_BYTES,
} from "./output-budget.js";
