import {
  defineConnector,
  defineTool,
  ConnectorSdkError,
  type DefinedConnector,
} from "@osva-ai/connector-sdk";

import {
  CONNECTOR_KEY,
  CONNECTOR_NAME,
  CONNECTOR_VERSION,
  SHOPIFY_INVENTORY_LEVELS_LIST_TOOL,
  SHOPIFY_LOCATION_LIST_TOOL,
  SHOPIFY_ORDER_GET_TOOL,
  SHOPIFY_ORDER_LIST_TOOL,
  SHOPIFY_PRODUCT_GET_TOOL,
  SHOPIFY_PRODUCT_LIST_TOOL,
  SHOPIFY_SHOP_GET_TOOL,
} from "./constants.js";
import { mapShopifyError } from "./map-shopify-error.js";
import {
  mapInventoryLevelsResponse,
  mapLocationListResponse,
  mapOrderGetResponse,
  mapOrderListResponse,
  mapProductGetResponse,
  mapProductListResponse,
  mapShopGetResponse,
} from "./normalize-shopify.js";
import type { ShopifyClient } from "./shopify-client.js";
import {
  inventoryLevelsListInputJsonSchema,
  inventoryLevelsListInputSchema,
  locationListInputJsonSchema,
  locationListInputSchema,
  orderGetInputJsonSchema,
  orderGetInputSchema,
  orderListInputJsonSchema,
  orderListInputSchema,
  productGetInputJsonSchema,
  productGetInputSchema,
  productListInputJsonSchema,
  productListInputSchema,
  shopGetInputJsonSchema,
  shopGetInputSchema,
} from "./tool-schemas.js";

export interface CreateShopifyConnectorOptions {
  readonly client: ShopifyClient;
  readonly accessToken?: string;
}

function invalidInputError(): ConnectorSdkError {
  return new ConnectorSdkError("INVALID_INPUT", "Invalid tool input.");
}

function mapError(error: unknown, accessToken?: string): ConnectorSdkError {
  return mapShopifyError(error, { accessToken });
}

export function createShopifyConnector(
  options: CreateShopifyConnectorOptions,
): DefinedConnector {
  const accessToken = options.accessToken;

  return defineConnector({
    key: CONNECTOR_KEY,
    name: CONNECTOR_NAME,
    description:
      "Shopify Admin API read-only connector for OSVA Connector Profile V1 (shop metadata, products, non-PII orders, inventory levels, and locations). Tool authorization is enforced by OSVA ToolPolicy; Shopify access scopes and protected customer data rules remain the primary authorization layers on the provider side.",
    version: CONNECTOR_VERSION,
    tools: [
      defineTool({
        name: SHOPIFY_SHOP_GET_TOOL,
        description:
          "Returns basic shop metadata (read-only). Requires read access to shop settings.",
        inputSchema: shopGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = shopGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const data = await options.client.getShop({
              signal: context.signal,
            });
            return mapShopGetResponse(data);
          } catch (error) {
            throw mapError(error, accessToken);
          }
        },
      }),
      defineTool({
        name: SHOPIFY_PRODUCT_LIST_TOOL,
        description:
          "Lists products with cursor pagination and an optional bounded Shopify search query. Variant data is a bounded preview (not guaranteed complete). Does not return unrestricted metafields.",
        inputSchema: productListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = productListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const data = await options.client.listProducts({
              limit: parsed.data.limit,
              ...(parsed.data.cursor !== undefined
                ? { cursor: parsed.data.cursor }
                : {}),
              ...(parsed.data.query !== undefined
                ? { query: parsed.data.query }
                : {}),
              signal: context.signal,
            });
            return mapProductListResponse(data);
          } catch (error) {
            throw mapError(error, accessToken);
          }
        },
      }),
      defineTool({
        name: SHOPIFY_PRODUCT_GET_TOOL,
        description:
          "Returns a single product summary with bounded variant preview (read-only). Does not return unrestricted metafields.",
        inputSchema: productGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = productGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const data = await options.client.getProduct({
              id: parsed.data.id,
              signal: context.signal,
            });
            return mapProductGetResponse(data);
          } catch (error) {
            throw mapError(error, accessToken);
          }
        },
      }),
      defineTool({
        name: SHOPIFY_ORDER_LIST_TOOL,
        description:
          "Lists orders with cursor pagination and an optional bounded search query. Returns non-PII financial and fulfillment summaries only (no customer names, emails, phones, addresses, or payment instruments).",
        inputSchema: orderListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = orderListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const data = await options.client.listOrders({
              limit: parsed.data.limit,
              ...(parsed.data.cursor !== undefined
                ? { cursor: parsed.data.cursor }
                : {}),
              ...(parsed.data.query !== undefined
                ? { query: parsed.data.query }
                : {}),
              signal: context.signal,
            });
            return mapOrderListResponse(data);
          } catch (error) {
            throw mapError(error, accessToken);
          }
        },
      }),
      defineTool({
        name: SHOPIFY_ORDER_GET_TOOL,
        description:
          "Returns a non-PII order summary with totals, statuses, and a bounded line-item preview. Protected customer data and order-history scope restrictions may still apply on Shopify's side.",
        inputSchema: orderGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = orderGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const data = await options.client.getOrder({
              id: parsed.data.id,
              signal: context.signal,
            });
            return mapOrderGetResponse(data);
          } catch (error) {
            throw mapError(error, accessToken);
          }
        },
      }),
      defineTool({
        name: SHOPIFY_INVENTORY_LEVELS_LIST_TOOL,
        description:
          "Lists inventory levels scoped by locationId or inventoryItemId (at least one required). Quantities include available and selected safe inventory states. Uses Shopify inventoryLevels connections (no global unscoped traversal).",
        inputSchema: inventoryLevelsListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = inventoryLevelsListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const data = await options.client.listInventoryLevels({
              ...(parsed.data.locationId !== undefined
                ? { locationId: parsed.data.locationId }
                : {}),
              ...(parsed.data.inventoryItemId !== undefined
                ? { inventoryItemId: parsed.data.inventoryItemId }
                : {}),
              limit: parsed.data.limit,
              ...(parsed.data.cursor !== undefined
                ? { cursor: parsed.data.cursor }
                : {}),
              signal: context.signal,
            });
            return mapInventoryLevelsResponse(data, {
              ...(parsed.data.locationId !== undefined
                ? { locationId: parsed.data.locationId }
                : {}),
              ...(parsed.data.inventoryItemId !== undefined
                ? { inventoryItemId: parsed.data.inventoryItemId }
                : {}),
            });
          } catch (error) {
            throw mapError(error, accessToken);
          }
        },
      }),
      defineTool({
        name: SHOPIFY_LOCATION_LIST_TOOL,
        description:
          "Lists fulfillment locations without physical address fields (read-only).",
        inputSchema: locationListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = locationListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const data = await options.client.listLocations({
              limit: parsed.data.limit,
              ...(parsed.data.cursor !== undefined
                ? { cursor: parsed.data.cursor }
                : {}),
              signal: context.signal,
            });
            return mapLocationListResponse(data);
          } catch (error) {
            throw mapError(error, accessToken);
          }
        },
      }),
    ],
  });
}
