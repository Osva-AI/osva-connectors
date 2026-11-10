export const CONNECTOR_KEY = "osva-connector-notion";
export const CONNECTOR_NAME = "OSVA Notion Connector";
export const CONNECTOR_VERSION = "0.1.1";

export const NOTION_SEARCH_TOOL = "notion.search";
export const NOTION_PAGE_GET_TOOL = "notion.page.get";
export const NOTION_BLOCK_CHILDREN_LIST_TOOL = "notion.block.children.list";
export const NOTION_DATABASE_GET_TOOL = "notion.database.get";
export const NOTION_DATASOURCE_GET_TOOL = "notion.datasource.get";
export const NOTION_DATASOURCE_QUERY_TOOL = "notion.datasource.query";
export const NOTION_PAGE_CREATE_TOOL = "notion.page.create";
export const NOTION_PAGE_UPDATE_TOOL = "notion.page.update";
export const NOTION_BLOCK_CHILDREN_APPEND_TOOL = "notion.block.children.append";

export const NOTION_ACCESS_TOKEN_ENV = "OSVA_CONNECTOR_NOTION_ACCESS_TOKEN";
export const NOTION_TIMEOUT_MS_ENV = "OSVA_CONNECTOR_NOTION_TIMEOUT_MS";
export const NOTION_API_VERSION_ENV = "OSVA_CONNECTOR_NOTION_API_VERSION";
export const NOTION_WRITE_ENABLED_ENV = "OSVA_CONNECTOR_NOTION_WRITE_ENABLED";
export const NOTION_HOST_WRITES_APPROVED_ENV =
  "OSVA_CONNECTOR_NOTION_HOST_WRITES_APPROVED";
export const NOTION_MAX_BLOCK_DEPTH_ENV =
  "OSVA_CONNECTOR_NOTION_MAX_BLOCK_DEPTH";

export const NOTION_API_HOST = "https://api.notion.com";

export const DEFAULT_NOTION_API_VERSION = "2026-03-11";
export const SUPPORTED_NOTION_API_VERSIONS = [
  "2026-03-11",
  "2025-09-03",
] as const;

export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
export const MIN_REQUEST_TIMEOUT_MS = 1_000;
export const MAX_REQUEST_TIMEOUT_MS = 120_000;

export const LIST_DEFAULT_PAGE_SIZE = 50;
export const LIST_MAX_PAGE_SIZE = 100;
export const MAX_CURSOR_LENGTH = 512;
export const MAX_NOTION_ID_LENGTH = 64;

export const DEFAULT_MAX_BLOCK_DEPTH = 2;
export const MIN_MAX_BLOCK_DEPTH = 0;
export const MAX_MAX_BLOCK_DEPTH = 4;

export const MAX_HTTP_RESPONSE_BYTES = 2_097_152;
export const READ_ONLY_MAX_RETRIES = 1;
export const READ_ONLY_RETRY_DELAY_MS = 1_000;

export const MAX_APPEND_BLOCKS = 20;
export const MAX_RICH_TEXT_SEGMENTS = 64;

export {
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  OUTPUT_MAX_STRUCTURED_JSON_BYTES,
} from "./output-budget.js";
