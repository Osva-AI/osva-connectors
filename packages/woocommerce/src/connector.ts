import {
  defineConnector,
  defineTool,
  ConnectorSdkError,
  type DefinedConnector,
} from "@osva-ai/connector-sdk";
import type { WoocommerceConfig } from "./schemas.js";
import type { WoocommerceClient } from "./woocommerce-client.js";

export interface CreateWoocommerceConnectorOptions {
  readonly client: WoocommerceClient;
  readonly config: WoocommerceConfig;
  readonly credentialsForRedaction?: {
    readonly consumerKey: string;
    readonly consumerSecret: string;
  };
}
import {
  CONNECTOR_KEY,
  CONNECTOR_NAME,
  CONNECTOR_VERSION,
  LIST_DEFAULT_LIMIT,
  WOOCOMMERCE_ALLOWED_ORDER_IDS_ENV,
  WOOCOMMERCE_ALLOWED_PRODUCT_IDS_ENV,
  WOOCOMMERCE_CATEGORY_LIST_TOOL,
  WOOCOMMERCE_ORDER_GET_TOOL,
  WOOCOMMERCE_ORDER_LIST_TOOL,
  WOOCOMMERCE_ORDER_NOTE_LIST_TOOL,
  WOOCOMMERCE_ORDER_STATUS_UPDATE_TOOL,
  WOOCOMMERCE_PRODUCT_GET_TOOL,
  WOOCOMMERCE_PRODUCT_LIST_TOOL,
  WOOCOMMERCE_PRODUCT_UPDATE_TOOL,
  WOOCOMMERCE_PRODUCT_VARIATION_GET_TOOL,
  WOOCOMMERCE_PRODUCT_VARIATION_LIST_TOOL,
} from "./constants.js";
import {
  assertIdAllowed,
  assertMutationAllowlistConfigured,
  createNumericIdAllowlist,
  filterByNumericAllowlist,
  type NumericIdAllowlist,
} from "./id-allowlist.js";
import { mapWoocommerceError } from "./map-woocommerce-error.js";
import {
  buildWoocommerceOrderStatusBody,
  buildWoocommerceProductUpdateBody,
} from "./mutation-allowlist.js";
import {
  mapCategoryListResponse,
  mapOrderGetResponse,
  mapOrderListResponse,
  mapOrderNoteListResponse,
  mapOrderStatusUpdateResponse,
  mapProductGetResponse,
  mapProductListResponse,
  mapProductUpdateResponse,
  mapVariationGetResponse,
  mapVariationListResponse,
} from "./normalize-woocommerce.js";
import {
  categoryListInputJsonSchema,
  categoryListInputSchema,
  orderGetInputJsonSchema,
  orderGetInputSchema,
  orderListInputJsonSchema,
  orderListInputSchema,
  orderNoteListInputJsonSchema,
  orderNoteListInputSchema,
  orderStatusUpdateInputJsonSchema,
  orderStatusUpdateInputSchema,
  productGetInputJsonSchema,
  productGetInputSchema,
  productListInputJsonSchema,
  productListInputSchema,
  productUpdateInputJsonSchema,
  productUpdateInputSchema,
  variationGetInputJsonSchema,
  variationGetInputSchema,
  variationListInputJsonSchema,
  variationListInputSchema,
} from "./tool-schemas.js";
function invalidInputError() {
  return new ConnectorSdkError("INVALID_INPUT", "Invalid tool input.");
}
function mapConnectorError(
  error: unknown,
  options: CreateWoocommerceConnectorOptions,
  ambiguousWrite?: boolean,
): ConnectorSdkError {
  return mapWoocommerceError(error, {
    consumerKey: options.credentialsForRedaction?.consumerKey,
    consumerSecret: options.credentialsForRedaction?.consumerSecret,
    ...(ambiguousWrite === true ? { ambiguousWrite: true } : {}),
  });
}
function assertWritesAllowed(config: WoocommerceConfig): void {
  if (!config.writeEnabled) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "WooCommerce mutations are disabled. Set OSVA_CONNECTOR_WOOCOMMERCE_WRITE_ENABLED=true.",
    );
  }
  if (!config.hostWritesApproved) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "WooCommerce mutations require host approval (OSVA_CONNECTOR_WOOCOMMERCE_HOST_WRITES_APPROVED=true).",
    );
  }
}
function assertParentProductAllowed(
  productAllowlist: NumericIdAllowlist | undefined,
  productId: number,
): void {
  assertIdAllowed(productAllowlist, productId, "Product");
}
export function createWoocommerceConnector(
  options: CreateWoocommerceConnectorOptions,
): DefinedConnector {
  const { config, client } = options;
  const productAllowlist = createNumericIdAllowlist(config.allowedProductIds);
  const orderAllowlist = createNumericIdAllowlist(config.allowedOrderIds);
  const writableFields = new Set(config.writableProductFields);
  return defineConnector({
    key: CONNECTOR_KEY,
    name: CONNECTOR_NAME,
    version: CONNECTOR_VERSION,
    description:
      "WooCommerce REST API v3 connector (Profile V1): bounded catalog, variations, categories, orders, and order notes with default-denied PII, host allowlists, and gated product/order status updates. Not a WordPress MCP proxy.",
    tools: [
      defineTool({
        name: WOOCOMMERCE_PRODUCT_LIST_TOOL,
        description:
          "Lists products with bounded pagination and optional search, status, and category filters. Results respect OSVA_CONNECTOR_WOOCOMMERCE_ALLOWED_PRODUCT_IDS when set.",
        inputSchema: productListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = productListInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          if (productAllowlist?.allowedIds.size === 0) {
            return { pageInfo: { page: 1, hasMore: false }, products: [] };
          }
          const page = parsed.data.page ?? 1;
          const limit = parsed.data.limit ?? LIST_DEFAULT_LIMIT;
          try {
            const { items, headers } = await client.listProducts(
              {
                page,
                perPage: limit,
                ...(parsed.data.search ? { search: parsed.data.search } : {}),
                ...(parsed.data.status ? { status: parsed.data.status } : {}),
                ...(parsed.data.categoryId !== undefined
                  ? { category: parsed.data.categoryId }
                  : {}),
              },
              context.signal,
            );
            if (!Array.isArray(items)) throw invalidInputError();
            const filtered = filterByNumericAllowlist(
              productAllowlist,
              items,
              (raw) => readProductId(raw),
            );
            return mapProductListResponse(filtered, headers, page);
          } catch (error) {
            throw mapConnectorError(error, options);
          }
        },
      }),
      defineTool({
        name: WOOCOMMERCE_PRODUCT_GET_TOOL,
        description:
          "Returns a single product; enforces product allowlist when configured.",
        inputSchema: productGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = productGetInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          assertIdAllowed(productAllowlist, parsed.data.productId, "Product");
          try {
            return mapProductGetResponse(
              await client.getProduct(parsed.data.productId, context.signal),
            );
          } catch (error) {
            throw mapConnectorError(error, options);
          }
        },
      }),
      defineTool({
        name: WOOCOMMERCE_PRODUCT_VARIATION_LIST_TOOL,
        description:
          "Lists variations for a parent product after validating parent product access.",
        inputSchema: variationListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = variationListInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          assertParentProductAllowed(productAllowlist, parsed.data.productId);
          const page = parsed.data.page ?? 1;
          const limit = parsed.data.limit ?? LIST_DEFAULT_LIMIT;
          try {
            const { items, headers } = await client.listProductVariations(
              parsed.data.productId,
              { page, perPage: limit },
              context.signal,
            );
            return mapVariationListResponse(items, headers, page);
          } catch (error) {
            throw mapConnectorError(error, options);
          }
        },
      }),
      defineTool({
        name: WOOCOMMERCE_PRODUCT_VARIATION_GET_TOOL,
        description:
          "Returns a single product variation after parent product allowlist checks.",
        inputSchema: variationGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = variationGetInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          assertParentProductAllowed(productAllowlist, parsed.data.productId);
          try {
            return mapVariationGetResponse(
              await client.getProductVariation(
                parsed.data.productId,
                parsed.data.variationId,
                context.signal,
              ),
            );
          } catch (error) {
            throw mapConnectorError(error, options);
          }
        },
      }),
      defineTool({
        name: WOOCOMMERCE_CATEGORY_LIST_TOOL,
        description: "Lists product categories with bounded pagination.",
        inputSchema: categoryListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = categoryListInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          const page = parsed.data.page ?? 1;
          const limit = parsed.data.limit ?? LIST_DEFAULT_LIMIT;
          try {
            const { items, headers } = await client.listCategories(
              {
                page,
                perPage: limit,
                ...(parsed.data.search ? { search: parsed.data.search } : {}),
                ...(parsed.data.parentId !== undefined
                  ? { parent: parsed.data.parentId }
                  : {}),
              },
              context.signal,
            );
            return mapCategoryListResponse(items, headers, page);
          } catch (error) {
            throw mapConnectorError(error, options);
          }
        },
      }),
      defineTool({
        name: WOOCOMMERCE_ORDER_LIST_TOOL,
        description:
          "Lists orders with optional status and ISO date filters; strips customer PII by default.",
        inputSchema: orderListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = orderListInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          if (orderAllowlist?.allowedIds.size === 0) {
            return { pageInfo: { page: 1, hasMore: false }, orders: [] };
          }
          const page = parsed.data.page ?? 1;
          const limit = parsed.data.limit ?? LIST_DEFAULT_LIMIT;
          try {
            const { items, headers } = await client.listOrders(
              {
                page,
                perPage: limit,
                ...(parsed.data.search ? { search: parsed.data.search } : {}),
                ...(parsed.data.status ? { status: parsed.data.status } : {}),
                ...(parsed.data.after ? { after: parsed.data.after } : {}),
                ...(parsed.data.before ? { before: parsed.data.before } : {}),
              },
              context.signal,
            );
            if (!Array.isArray(items)) throw invalidInputError();
            const filtered = filterByNumericAllowlist(
              orderAllowlist,
              items,
              (raw) => readOrderId(raw),
            );
            return mapOrderListResponse(
              filtered,
              headers,
              page,
              config.includeOrderPii,
            );
          } catch (error) {
            throw mapConnectorError(error, options);
          }
        },
      }),
      defineTool({
        name: WOOCOMMERCE_ORDER_GET_TOOL,
        description:
          "Returns a single order; enforces order allowlist when configured.",
        inputSchema: orderGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = orderGetInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          assertIdAllowed(orderAllowlist, parsed.data.orderId, "Order");
          try {
            return mapOrderGetResponse(
              await client.getOrder(parsed.data.orderId, context.signal),
              config.includeOrderPii,
            );
          } catch (error) {
            throw mapConnectorError(error, options);
          }
        },
      }),
      defineTool({
        name: WOOCOMMERCE_ORDER_NOTE_LIST_TOOL,
        description:
          "Lists order notes; customer-facing note text is redacted unless PII env is enabled.",
        inputSchema: orderNoteListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = orderNoteListInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          assertIdAllowed(orderAllowlist, parsed.data.orderId, "Order");
          const page = parsed.data.page ?? 1;
          const limit = parsed.data.limit ?? LIST_DEFAULT_LIMIT;
          try {
            const { items, headers } = await client.listOrderNotes(
              parsed.data.orderId,
              { page, perPage: limit },
              context.signal,
            );
            return mapOrderNoteListResponse(
              items,
              headers,
              page,
              config.includeOrderPii,
            );
          } catch (error) {
            throw mapConnectorError(error, options);
          }
        },
      }),
      defineTool({
        name: WOOCOMMERCE_PRODUCT_UPDATE_TOOL,
        description:
          "Updates allowlisted product fields (decimal price strings). Requires write gates and non-empty product ID allowlist.",
        inputSchema: productUpdateInputJsonSchema,
        handler: async (input, context) => {
          assertWritesAllowed(config);
          assertMutationAllowlistConfigured(
            productAllowlist,
            WOOCOMMERCE_ALLOWED_PRODUCT_IDS_ENV,
          );
          const parsed = productUpdateInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          assertIdAllowed(productAllowlist, parsed.data.productId, "Product");
          const body = buildWoocommerceProductUpdateBody(
            parsed.data.fields,
            writableFields,
          );
          try {
            return mapProductUpdateResponse(
              await client.updateProduct(
                parsed.data.productId,
                body,
                context.signal,
              ),
            );
          } catch (error) {
            throw mapConnectorError(error, options, true);
          }
        },
      }),
      defineTool({
        name: WOOCOMMERCE_ORDER_STATUS_UPDATE_TOOL,
        description:
          "Updates order status only. May trigger provider emails/automation. Requires write gates and non-empty order ID allowlist.",
        inputSchema: orderStatusUpdateInputJsonSchema,
        handler: async (input, context) => {
          assertWritesAllowed(config);
          assertMutationAllowlistConfigured(
            orderAllowlist,
            WOOCOMMERCE_ALLOWED_ORDER_IDS_ENV,
          );
          const parsed = orderStatusUpdateInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          assertIdAllowed(orderAllowlist, parsed.data.orderId, "Order");
          const body = buildWoocommerceOrderStatusBody(
            parsed.data.status,
            config.allowedOrderTargetStatuses,
          );
          try {
            return mapOrderStatusUpdateResponse(
              await client.updateOrderStatus(
                parsed.data.orderId,
                body,
                context.signal,
              ),
              config.includeOrderPii,
            );
          } catch (error) {
            throw mapConnectorError(error, options, true);
          }
        },
      }),
    ],
  });
}
function readProductId(raw: unknown): number {
  if (typeof raw !== "object" || raw === null) {
    return Number.NaN;
  }
  const id = (raw as { id?: unknown }).id;
  return typeof id === "number" ? id : Number.parseInt(String(id), 10);
}
function readOrderId(raw: unknown): number {
  return readProductId(raw);
}
