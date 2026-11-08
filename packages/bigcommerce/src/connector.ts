import {
  defineConnector,
  defineTool,
  ConnectorSdkError,
  type DefinedConnector,
} from "@osva-ai/connector-sdk";
import type { BigcommerceConfig } from "./schemas.js";
import type { BigcommerceClient } from "./bigcommerce-client.js";

export interface CreateBigcommerceConnectorOptions {
  readonly client: BigcommerceClient;
  readonly config: BigcommerceConfig;
  readonly accessTokenForRedaction?: string;
}
import {
  BIGCOMMERCE_ALLOWED_ORDER_IDS_ENV,
  BIGCOMMERCE_ALLOWED_PRODUCT_IDS_ENV,
  BIGCOMMERCE_CATEGORY_LIST_TOOL,
  BIGCOMMERCE_CATEGORY_TREE_LIST_TOOL,
  BIGCOMMERCE_ORDER_GET_TOOL,
  BIGCOMMERCE_ORDER_LIST_TOOL,
  BIGCOMMERCE_ORDER_PRODUCT_LIST_TOOL,
  BIGCOMMERCE_ORDER_STATUS_UPDATE_TOOL,
  BIGCOMMERCE_PRODUCT_GET_TOOL,
  BIGCOMMERCE_PRODUCT_LIST_TOOL,
  BIGCOMMERCE_PRODUCT_UPDATE_TOOL,
  BIGCOMMERCE_PRODUCT_VARIANT_LIST_TOOL,
  CONNECTOR_KEY,
  CONNECTOR_NAME,
  CONNECTOR_VERSION,
  LIST_DEFAULT_LIMIT,
} from "./constants.js";
import {
  assertIdAllowed,
  assertMutationAllowlistConfigured,
  createNumericIdAllowlist,
  filterByNumericAllowlist,
  type NumericIdAllowlist,
} from "./id-allowlist.js";
import { mapBigcommerceError } from "./map-bigcommerce-error.js";
import {
  buildBigcommerceOrderStatusBody,
  buildBigcommerceProductUpdateBody,
} from "./mutation-allowlist.js";
import {
  mapCategoryListResponse,
  mapCategoryTreeListResponse,
  mapOrderGetResponse,
  mapOrderListResponse,
  mapOrderProductListResponse,
  mapOrderStatusUpdateResponse,
  mapProductGetResponse,
  mapProductListResponse,
  mapProductUpdateResponse,
  mapVariantListResponse,
} from "./normalize-bigcommerce.js";
import {
  categoryListInputJsonSchema,
  categoryListInputSchema,
  categoryTreeListInputJsonSchema,
  categoryTreeListInputSchema,
  orderGetInputJsonSchema,
  orderGetInputSchema,
  orderListInputJsonSchema,
  orderListInputSchema,
  orderProductListInputJsonSchema,
  orderProductListInputSchema,
  orderStatusUpdateInputJsonSchema,
  orderStatusUpdateInputSchema,
  productGetInputJsonSchema,
  productGetInputSchema,
  productListInputJsonSchema,
  productListInputSchema,
  productUpdateInputJsonSchema,
  productUpdateInputSchema,
  variantListInputJsonSchema,
  variantListInputSchema,
} from "./tool-schemas.js";
function invalidInputError() {
  return new ConnectorSdkError("INVALID_INPUT", "Invalid tool input.");
}
function mapConnectorError(
  error: unknown,
  options: CreateBigcommerceConnectorOptions,
  ambiguousWrite?: boolean,
): ConnectorSdkError {
  return mapBigcommerceError(error, {
    accessToken: options.accessTokenForRedaction,
    ...(ambiguousWrite === true ? { ambiguousWrite: true } : {}),
  });
}
function assertWritesAllowed(config: BigcommerceConfig): void {
  if (!config.writeEnabled) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "BigCommerce mutations are disabled. Set OSVA_CONNECTOR_BIGCOMMERCE_WRITE_ENABLED=true.",
    );
  }
  if (!config.hostWritesApproved) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "BigCommerce mutations require host approval (OSVA_CONNECTOR_BIGCOMMERCE_HOST_WRITES_APPROVED=true).",
    );
  }
}
function assertTreeAllowed(
  treeAllowlist: NumericIdAllowlist | undefined,
  treeId: number,
): void {
  assertIdAllowed(treeAllowlist, treeId, "Category tree");
}
export function createBigcommerceConnector(
  options: CreateBigcommerceConnectorOptions,
): DefinedConnector {
  const { config, client } = options;
  const productAllowlist = createNumericIdAllowlist(config.allowedProductIds);
  const orderAllowlist = createNumericIdAllowlist(config.allowedOrderIds);
  const treeAllowlist = createNumericIdAllowlist(config.allowedCategoryTreeIds);
  return defineConnector({
    key: CONNECTOR_KEY,
    name: CONNECTOR_NAME,
    version: CONNECTOR_VERSION,
    description:
      "BigCommerce Admin API connector (Profile V1): Catalog v3, category trees, Orders v2, gated catalog/order status updates, host allowlists, default-denied PII. Not a storefront MCP proxy.",
    tools: [
      defineTool({
        name: BIGCOMMERCE_PRODUCT_LIST_TOOL,
        description: "Lists catalog products (v3) with bounded pagination.",
        inputSchema: productListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = productListInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          if (productAllowlist?.allowedIds.size === 0) {
            return {
              pageInfo: { page: 1, hasMore: false },
              products: [],
            };
          }
          const page = parsed.data.page ?? 1;
          const limit = parsed.data.limit ?? LIST_DEFAULT_LIMIT;
          try {
            const { envelope } = await client.listProducts(
              {
                page,
                limit,
                ...(parsed.data.search ? { search: parsed.data.search } : {}),
              },
              context.signal,
            );
            const record = envelope as Record<string, unknown>;
            const items = Array.isArray(record.data) ? record.data : [];
            const filtered = filterByNumericAllowlist(
              productAllowlist,
              items,
              (raw) => readId(raw),
            );
            const meta =
              envelope !== null &&
              typeof envelope === "object" &&
              "meta" in envelope
                ? (envelope as { meta?: unknown }).meta
                : undefined;
            return mapProductListResponse({ data: filtered, meta }, page);
          } catch (error) {
            throw mapConnectorError(error, options);
          }
        },
      }),
      defineTool({
        name: BIGCOMMERCE_PRODUCT_GET_TOOL,
        description: "Returns a catalog product (v3).",
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
        name: BIGCOMMERCE_PRODUCT_VARIANT_LIST_TOOL,
        description: "Lists variants for a catalog product (v3).",
        inputSchema: variantListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = variantListInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          assertIdAllowed(productAllowlist, parsed.data.productId, "Product");
          const page = parsed.data.page ?? 1;
          const limit = parsed.data.limit ?? LIST_DEFAULT_LIMIT;
          try {
            const { envelope } = await client.listProductVariants(
              parsed.data.productId,
              { page, limit },
              context.signal,
            );
            return mapVariantListResponse(envelope, page);
          } catch (error) {
            throw mapConnectorError(error, options);
          }
        },
      }),
      defineTool({
        name: BIGCOMMERCE_CATEGORY_TREE_LIST_TOOL,
        description:
          "Lists category trees (v3). Respects OSVA_CONNECTOR_BIGCOMMERCE_ALLOWED_CATEGORY_TREE_IDS when set.",
        inputSchema: categoryTreeListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = categoryTreeListInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          if (treeAllowlist?.allowedIds.size === 0) {
            return { pageInfo: { page: 1, hasMore: false }, trees: [] };
          }
          try {
            const { envelope } = await client.listCategoryTrees(context.signal);
            const record = envelope as Record<string, unknown>;
            const items = Array.isArray(record.data) ? record.data : [];
            const filtered = filterByNumericAllowlist(
              treeAllowlist,
              items,
              (raw) => readId(raw),
            );
            return mapCategoryTreeListResponse({ data: filtered });
          } catch (error) {
            throw mapConnectorError(error, options);
          }
        },
      }),
      defineTool({
        name: BIGCOMMERCE_CATEGORY_LIST_TOOL,
        description: "Lists categories within an allowed category tree (v3).",
        inputSchema: categoryListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = categoryListInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          assertTreeAllowed(treeAllowlist, parsed.data.treeId);
          const page = parsed.data.page ?? 1;
          const limit = parsed.data.limit ?? LIST_DEFAULT_LIMIT;
          try {
            const { envelope } = await client.listCategoriesInTree(
              parsed.data.treeId,
              {
                page,
                limit,
                ...(parsed.data.parentId !== undefined
                  ? { parentId: parsed.data.parentId }
                  : {}),
              },
              context.signal,
            );
            return mapCategoryListResponse(envelope, page);
          } catch (error) {
            throw mapConnectorError(error, options);
          }
        },
      }),
      defineTool({
        name: BIGCOMMERCE_ORDER_LIST_TOOL,
        description:
          "Lists orders (v2) with bounded pagination; PII redacted by default.",
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
            const data = await client.listOrders(
              {
                page,
                limit,
                ...(parsed.data.minDateCreated
                  ? { minDateCreated: parsed.data.minDateCreated }
                  : {}),
                ...(parsed.data.maxDateCreated
                  ? { maxDateCreated: parsed.data.maxDateCreated }
                  : {}),
              },
              context.signal,
            );
            const items = Array.isArray(data) ? data : [];
            const filtered = filterByNumericAllowlist(
              orderAllowlist,
              items,
              (raw) => readId(raw),
            );
            return mapOrderListResponse(filtered, page, config.includeOrderPii);
          } catch (error) {
            throw mapConnectorError(error, options);
          }
        },
      }),
      defineTool({
        name: BIGCOMMERCE_ORDER_GET_TOOL,
        description: "Returns a single order (v2).",
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
        name: BIGCOMMERCE_ORDER_PRODUCT_LIST_TOOL,
        description: "Lists line items for an order (v2 order products).",
        inputSchema: orderProductListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = orderProductListInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          assertIdAllowed(orderAllowlist, parsed.data.orderId, "Order");
          try {
            return mapOrderProductListResponse(
              await client.listOrderProducts(
                parsed.data.orderId,
                context.signal,
              ),
            );
          } catch (error) {
            throw mapConnectorError(error, options);
          }
        },
      }),
      defineTool({
        name: BIGCOMMERCE_PRODUCT_UPDATE_TOOL,
        description:
          "Updates allowlisted catalog fields (price, sale_price, is_visible). Requires write gates and product ID allowlist.",
        inputSchema: productUpdateInputJsonSchema,
        handler: async (input, context) => {
          assertWritesAllowed(config);
          assertMutationAllowlistConfigured(
            productAllowlist,
            BIGCOMMERCE_ALLOWED_PRODUCT_IDS_ENV,
          );
          const parsed = productUpdateInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          assertIdAllowed(productAllowlist, parsed.data.productId, "Product");
          const body = buildBigcommerceProductUpdateBody(parsed.data.fields);
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
        name: BIGCOMMERCE_ORDER_STATUS_UPDATE_TOOL,
        description:
          "Updates order status_id only (v2). Requires write gates and order ID allowlist.",
        inputSchema: orderStatusUpdateInputJsonSchema,
        handler: async (input, context) => {
          assertWritesAllowed(config);
          assertMutationAllowlistConfigured(
            orderAllowlist,
            BIGCOMMERCE_ALLOWED_ORDER_IDS_ENV,
          );
          const parsed = orderStatusUpdateInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          assertIdAllowed(orderAllowlist, parsed.data.orderId, "Order");
          const body = buildBigcommerceOrderStatusBody(
            parsed.data.statusId,
            config.allowedOrderTargetStatusIds,
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
function readId(raw: unknown): number {
  if (typeof raw !== "object" || raw === null) return Number.NaN;
  const id = (raw as { id?: unknown }).id;
  return typeof id === "number" ? id : Number.parseInt(String(id), 10);
}
