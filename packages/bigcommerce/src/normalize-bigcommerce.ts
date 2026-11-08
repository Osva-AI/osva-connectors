import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import {
  LINE_ITEMS_PREVIEW_MAX,
  OUTPUT_MAX_CATEGORY_NAME,
  OUTPUT_MAX_PRICE_LENGTH,
  OUTPUT_MAX_PRODUCT_NAME,
  OUTPUT_MAX_SKU_LENGTH,
  OUTPUT_MAX_STATUS_LENGTH,
} from "./constants.js";
import {
  assertStructuredOutputWithinBudget,
  normalizeEssentialProviderString,
  normalizeTruncatableProviderString,
  packListWithinOutputBudget,
} from "./output-budget.js";
function asRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "BigCommerce returned an unexpected payload.",
    );
  }
  return value as Record<string, unknown>;
}
function readIntId(value: unknown, label: string): number {
  const num =
    typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isInteger(num) || num < 1) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      `BigCommerce returned an invalid ${label}.`,
    );
  }
  return num;
}
function readV3Pagination(envelope: unknown, page: number) {
  const record = asRecord(envelope);
  const meta = asRecord(record.meta ?? {});
  const pagination = asRecord(meta.pagination ?? {});
  const totalPages =
    typeof pagination.total_pages === "number"
      ? pagination.total_pages
      : undefined;
  const total =
    typeof pagination.total === "number" ? pagination.total : undefined;
  const hasMore =
    totalPages !== undefined &&
    Number.isInteger(totalPages) &&
    page < totalPages;
  return {
    page,
    hasMore,
    ...(totalPages !== undefined ? { totalPages } : {}),
    ...(total !== undefined ? { total } : {}),
  };
}
function readV3DataArray(envelope: unknown): unknown[] {
  const record = asRecord(envelope);
  const data = record.data;
  if (!Array.isArray(data)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "BigCommerce returned an unexpected payload.",
    );
  }
  return data;
}
function mapProductSummary(raw: unknown) {
  const product = asRecord(raw);
  return {
    id: readIntId(product.id, "product id"),
    name: normalizeEssentialProviderString(
      product.name,
      OUTPUT_MAX_PRODUCT_NAME,
    ),
    sku:
      normalizeTruncatableProviderString(product.sku, OUTPUT_MAX_SKU_LENGTH) ??
      null,
    price:
      typeof product.price === "number"
        ? String(product.price)
        : normalizeEssentialProviderString(
            product.price,
            OUTPUT_MAX_PRICE_LENGTH,
          ),
    salePrice:
      product.sale_price === undefined || product.sale_price === null
        ? null
        : String(product.sale_price),
    isVisible: product.is_visible === true,
    availability: normalizeEssentialProviderString(
      product.availability,
      OUTPUT_MAX_STATUS_LENGTH,
    ),
    type: normalizeEssentialProviderString(product.type, 32),
  };
}
function mapVariantSummary(raw: unknown) {
  const variant = asRecord(raw);
  return {
    id: readIntId(variant.id, "variant id"),
    sku:
      normalizeTruncatableProviderString(variant.sku, OUTPUT_MAX_SKU_LENGTH) ??
      null,
    price:
      variant.price_calculated ??
      variant.calculated_price ??
      variant.price ??
      null,
    inventoryLevel:
      typeof variant.inventory_level === "number"
        ? variant.inventory_level
        : undefined,
  };
}
function mapCategorySummary(raw: unknown) {
  const category = asRecord(raw);
  return {
    id: readIntId(category.category_id ?? category.id, "category id"),
    name: normalizeEssentialProviderString(
      category.name,
      OUTPUT_MAX_CATEGORY_NAME,
    ),
    parentId:
      category.parent_id === 0
        ? 0
        : category.parent_id === undefined
          ? 0
          : readIntId(category.parent_id, "parent id"),
    isVisible: category.is_visible === true,
  };
}
function stripOrderPii(order: Record<string, unknown>, includePii: boolean) {
  const summary: Record<string, unknown> = {
    id: readIntId(order.id, "order id"),
    status: normalizeEssentialProviderString(order.status, 64),
    statusId:
      typeof order.status_id === "number"
        ? order.status_id
        : Number(order.status_id),
    currency: normalizeEssentialProviderString(order.currency_code, 16),
    totalIncTax:
      order.total_inc_tax ??
      order.total_ex_tax ??
      order.subtotal_inc_tax ??
      null,
    dateCreated: normalizeEssentialProviderString(order.date_created, 64),
    paymentMethod: normalizeEssentialProviderString(order.payment_method, 64),
  };
  const products = order.products ?? order.consignment;
  if (Array.isArray(products)) {
    const lineItems = products.slice(0, LINE_ITEMS_PREVIEW_MAX).map((entry) => {
      const item = asRecord(entry);
      return {
        id: readIntId(item.id, "line item id"),
        productId: item.product_id,
        name: normalizeEssentialProviderString(
          item.name,
          OUTPUT_MAX_PRODUCT_NAME,
        ),
        quantity: item.quantity,
        sku:
          normalizeTruncatableProviderString(item.sku, OUTPUT_MAX_SKU_LENGTH) ??
          null,
      };
    });
    summary.lineItems = lineItems;
    if (products.length > LINE_ITEMS_PREVIEW_MAX) {
      summary.lineItemsTruncated = true;
    }
  }
  if (includePii) {
    summary.billingAddress = order.billing_address;
    summary.shippingAddresses = order.shipping_addresses;
    summary.customerId = order.customer_id;
  }
  return summary;
}
export function mapStoreGetResponse(data: unknown) {
  const store = asRecord(data);
  const out = {
    name: normalizeEssentialProviderString(store.name, 256),
    domain: normalizeTruncatableProviderString(store.domain, 2_048),
    country: normalizeEssentialProviderString(store.country, 64),
    language: normalizeEssentialProviderString(store.language, 32),
    currency: normalizeEssentialProviderString(store.currency, 16),
    planLevel: store.plan_level,
    storeId: store.id,
  };
  assertStructuredOutputWithinBudget(out);
  return out;
}
export function mapProductListResponse(envelope: unknown, page: number) {
  const products = readV3DataArray(envelope).map((item) =>
    mapProductSummary(item),
  );
  const pageInfo = readV3Pagination(envelope, page);
  const packed = packListWithinOutputBudget({ pageInfo }, "products", products);
  assertStructuredOutputWithinBudget(packed);
  return packed;
}
export function mapProductGetResponse(data: unknown) {
  const record = asRecord(data);
  const product = record.data === undefined ? record : asRecord(record.data);
  const out = {
    ...mapProductSummary(product),
    description: normalizeTruncatableProviderString(product.description, 4_096),
  };
  assertStructuredOutputWithinBudget(out);
  return out;
}
export function mapVariantListResponse(envelope: unknown, page: number) {
  const variants = readV3DataArray(envelope).map((item) =>
    mapVariantSummary(item),
  );
  const pageInfo = readV3Pagination(envelope, page);
  const packed = packListWithinOutputBudget({ pageInfo }, "variants", variants);
  assertStructuredOutputWithinBudget(packed);
  return packed;
}
export function mapCategoryListResponse(envelope: unknown, page: number) {
  const categories = readV3DataArray(envelope).map((item) =>
    mapCategorySummary(item),
  );
  const pageInfo = readV3Pagination(envelope, page);
  const packed = packListWithinOutputBudget(
    { pageInfo },
    "categories",
    categories,
  );
  assertStructuredOutputWithinBudget(packed);
  return packed;
}
export function mapCategoryGetResponse(data: unknown) {
  const record = asRecord(data);
  const category = record.data === undefined ? record : asRecord(record.data);
  const out = mapCategorySummary(category);
  assertStructuredOutputWithinBudget(out);
  return out;
}
export function mapOrderListResponse(
  data: unknown,
  page: number,
  includePii: boolean,
) {
  if (!Array.isArray(data)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "BigCommerce returned an unexpected payload.",
    );
  }
  const orders = data.map((item) => stripOrderPii(asRecord(item), includePii));
  const packed = packListWithinOutputBudget(
    { pageInfo: { page, hasMore: data.length > 0 } },
    "orders",
    orders,
  );
  assertStructuredOutputWithinBudget(packed);
  return packed;
}
export function mapOrderGetResponse(data: unknown, includePii: boolean) {
  const out = stripOrderPii(asRecord(data), includePii);
  assertStructuredOutputWithinBudget(out);
  return out;
}
export function mapProductUpdateResponse(data: unknown) {
  return mapProductGetResponse(data);
}
export function mapOrderStatusUpdateResponse(
  data: unknown,
  includePii: boolean,
) {
  return mapOrderGetResponse(data, includePii);
}
export function mapCategoryTreeListResponse(envelope: unknown) {
  const trees = readV3DataArray(envelope).map((raw) => {
    const tree = asRecord(raw);
    return {
      id: readIntId(tree.id, "tree id"),
      name: normalizeEssentialProviderString(tree.name, 256),
    };
  });
  const packed = packListWithinOutputBudget(
    { pageInfo: { page: 1, hasMore: false } },
    "trees",
    trees,
  );
  assertStructuredOutputWithinBudget(packed);
  return packed;
}
export function mapOrderProductListResponse(data: unknown) {
  if (!Array.isArray(data)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "BigCommerce returned an unexpected payload.",
    );
  }
  const products = data.map((entry) => {
    const item = asRecord(entry);
    return {
      id: readIntId(item.id, "order product id"),
      productId: item.product_id,
      name: normalizeEssentialProviderString(
        item.name,
        OUTPUT_MAX_PRODUCT_NAME,
      ),
      quantity: item.quantity,
      sku:
        normalizeTruncatableProviderString(item.sku, OUTPUT_MAX_SKU_LENGTH) ??
        null,
      priceExTax: item.price_ex_tax,
      totalIncTax: item.total_inc_tax,
    };
  });
  const packed = packListWithinOutputBudget(
    { pageInfo: { page: 1, hasMore: false } },
    "orderProducts",
    products,
  );
  assertStructuredOutputWithinBudget(packed);
  return packed;
}
