export const CONNECTOR_KEY = "osva-connector-shopify";
export const CONNECTOR_NAME = "OSVA Shopify Connector";
export const CONNECTOR_VERSION = "0.1.0";

export const SHOPIFY_SHOP_GET_TOOL = "shopify.shop.get";
export const SHOPIFY_PRODUCT_LIST_TOOL = "shopify.product.list";
export const SHOPIFY_PRODUCT_GET_TOOL = "shopify.product.get";
export const SHOPIFY_ORDER_LIST_TOOL = "shopify.order.list";
export const SHOPIFY_ORDER_GET_TOOL = "shopify.order.get";
export const SHOPIFY_INVENTORY_LEVELS_LIST_TOOL =
  "shopify.inventory.levels.list";
export const SHOPIFY_LOCATION_LIST_TOOL = "shopify.location.list";

export const SHOPIFY_SHOP_ENV = "OSVA_CONNECTOR_SHOPIFY_SHOP";
export const SHOPIFY_ACCESS_TOKEN_ENV = "OSVA_CONNECTOR_SHOPIFY_ACCESS_TOKEN";
export const SHOPIFY_API_VERSION_ENV = "OSVA_CONNECTOR_SHOPIFY_API_VERSION";
export const SHOPIFY_TIMEOUT_MS_ENV = "OSVA_CONNECTOR_SHOPIFY_TIMEOUT_MS";

export const DEFAULT_API_VERSION = "2026-10";
export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
export const MIN_REQUEST_TIMEOUT_MS = 1_000;
export const MAX_REQUEST_TIMEOUT_MS = 120_000;

export const LIST_DEFAULT_LIMIT = 25;
export const LIST_MAX_LIMIT = 100;
export const MAX_CURSOR_LENGTH = 512;
export const MAX_SHOPIFY_SEARCH_QUERY_LENGTH = 256;

export const VARIANTS_PREVIEW_MAX = 10;
export const LINE_ITEMS_PREVIEW_MAX = 25;

/** Maximum raw HTTP response bytes read before JSON parsing. */
export const MAX_HTTP_RESPONSE_BYTES = 2_097_152;

export {
  OUTPUT_MAX_GID_LENGTH,
  OUTPUT_MAX_HANDLE_LENGTH,
  OUTPUT_MAX_ISO_TIMESTAMP,
  OUTPUT_MAX_MONEY_AMOUNT_LENGTH,
  OUTPUT_MAX_PRODUCT_TITLE,
  OUTPUT_MAX_SEARCH_QUERY,
  OUTPUT_MAX_SHOP_NAME,
  OUTPUT_MAX_SKU_LENGTH,
  OUTPUT_MAX_STRUCTURED_JSON_BYTES,
  OUTPUT_MAX_TIMEZONE_LENGTH,
  OUTPUT_MAX_VENDOR_LENGTH,
} from "./output-budget.js";
