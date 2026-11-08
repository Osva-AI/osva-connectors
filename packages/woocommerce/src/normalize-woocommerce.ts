import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import {
  LINE_ITEMS_PREVIEW_MAX,
  OUTPUT_MAX_CATEGORY_NAME,
  OUTPUT_MAX_PRICE_LENGTH,
  OUTPUT_MAX_PRODUCT_NAME,
  OUTPUT_MAX_SHORT_DESCRIPTION,
  OUTPUT_MAX_SKU_LENGTH,
  OUTPUT_MAX_STATUS_LENGTH,
  MAX_ORDER_NOTE_LENGTH,
  VARIATIONS_PREVIEW_MAX,
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
      "WooCommerce returned an unexpected payload.",
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
      `WooCommerce returned an invalid ${label}.`,
    );
  }
  return num;
}
function readPagination(headers: Headers, page: number) {
  const totalPagesRaw = headers.get("x-wp-totalpages");
  const totalRaw = headers.get("x-wp-total");
  const totalPages =
    totalPagesRaw === null ? undefined : Number.parseInt(totalPagesRaw, 10);
  const total = totalRaw === null ? undefined : Number.parseInt(totalRaw, 10);
  const hasMore =
    totalPages !== undefined &&
    Number.isInteger(totalPages) &&
    page < totalPages;
  return {
    page,
    ...(totalPages !== undefined && Number.isInteger(totalPages)
      ? { totalPages }
      : {}),
    ...(total !== undefined && Number.isInteger(total) ? { total } : {}),
    hasMore,
  };
}
function mapProductSummary(raw: unknown) {
  const product = asRecord(raw);
  return {
    id: readIntId(product.id, "product id"),
    name: normalizeEssentialProviderString(
      product.name,
      OUTPUT_MAX_PRODUCT_NAME,
      "WooCommerce returned an invalid product name.",
    ),
    slug: normalizeEssentialProviderString(product.slug, 128),
    status: normalizeEssentialProviderString(
      product.status,
      OUTPUT_MAX_STATUS_LENGTH,
    ),
    sku:
      normalizeTruncatableProviderString(product.sku, OUTPUT_MAX_SKU_LENGTH) ??
      null,
    price: normalizeEssentialProviderString(
      product.price,
      OUTPUT_MAX_PRICE_LENGTH,
    ),
    regularPrice: normalizeEssentialProviderString(
      product.regular_price,
      OUTPUT_MAX_PRICE_LENGTH,
    ),
    stockStatus: normalizeEssentialProviderString(
      product.stock_status,
      OUTPUT_MAX_STATUS_LENGTH,
    ),
    type: normalizeEssentialProviderString(product.type, 32),
    permalink: normalizeTruncatableProviderString(product.permalink, 2_048),
  };
}
function mapVariationSummary(raw: unknown) {
  const variation = asRecord(raw);
  return {
    id: readIntId(variation.id, "variation id"),
    sku:
      normalizeTruncatableProviderString(
        variation.sku,
        OUTPUT_MAX_SKU_LENGTH,
      ) ?? null,
    price: normalizeEssentialProviderString(
      variation.price,
      OUTPUT_MAX_PRICE_LENGTH,
    ),
    regularPrice: normalizeEssentialProviderString(
      variation.regular_price,
      OUTPUT_MAX_PRICE_LENGTH,
    ),
    stockStatus: normalizeEssentialProviderString(
      variation.stock_status,
      OUTPUT_MAX_STATUS_LENGTH,
    ),
    status: normalizeEssentialProviderString(
      variation.status,
      OUTPUT_MAX_STATUS_LENGTH,
    ),
  };
}
function mapCategorySummary(raw: unknown) {
  const category = asRecord(raw);
  return {
    id: readIntId(category.id, "category id"),
    name: normalizeEssentialProviderString(
      category.name,
      OUTPUT_MAX_CATEGORY_NAME,
      "WooCommerce returned an invalid category name.",
    ),
    slug: normalizeEssentialProviderString(category.slug, 128),
    parent:
      category.parent === 0 || category.parent === "0"
        ? 0
        : readIntId(category.parent, "category parent"),
    count:
      typeof category.count === "number"
        ? category.count
        : Number(category.count),
  };
}
function mapLineItemPreview(raw: unknown) {
  const item = asRecord(raw);
  return {
    id: readIntId(item.id, "line item id"),
    productId:
      item.product_id === 0 || item.product_id === "0"
        ? 0
        : readIntId(item.product_id, "product id"),
    name: normalizeEssentialProviderString(item.name, OUTPUT_MAX_PRODUCT_NAME),
    quantity:
      typeof item.quantity === "number"
        ? item.quantity
        : Number.parseInt(String(item.quantity), 10),
    sku:
      normalizeTruncatableProviderString(item.sku, OUTPUT_MAX_SKU_LENGTH) ??
      null,
    total: normalizeEssentialProviderString(
      item.total,
      OUTPUT_MAX_PRICE_LENGTH,
    ),
  };
}
function stripOrderPii(order: Record<string, unknown>, includePii: boolean) {
  const summary: Record<string, unknown> = {
    id: readIntId(order.id, "order id"),
    status: normalizeEssentialProviderString(
      order.status,
      OUTPUT_MAX_STATUS_LENGTH,
    ),
    currency: normalizeEssentialProviderString(order.currency, 16),
    total: normalizeEssentialProviderString(
      order.total,
      OUTPUT_MAX_PRICE_LENGTH,
    ),
    dateCreated: normalizeEssentialProviderString(order.date_created, 64),
    dateModified: normalizeEssentialProviderString(order.date_modified, 64),
    paymentMethodTitle: normalizeEssentialProviderString(
      order.payment_method_title,
      128,
    ),
  };
  const lineItems = order.line_items;
  if (Array.isArray(lineItems)) {
    const preview = lineItems
      .slice(0, LINE_ITEMS_PREVIEW_MAX)
      .map((item) => mapLineItemPreview(item));
    summary.lineItems = preview;
    if (lineItems.length > LINE_ITEMS_PREVIEW_MAX) {
      summary.lineItemsTruncated = true;
    }
  }
  if (includePii) {
    summary.customerId = order.customer_id;
    summary.billing = order.billing;
    summary.shipping = order.shipping;
  }
  return summary;
}
export function mapStoreGetResponse(data: unknown) {
  const root = asRecord(data);
  const environment = asRecord(root.environment ?? {});
  const out = {
    homeUrl: normalizeTruncatableProviderString(environment.home_url, 2_048),
    siteUrl: normalizeTruncatableProviderString(environment.site_url, 2_048),
    wpVersion: normalizeEssentialProviderString(environment.wp_version, 32),
    wpMultisite: environment.wp_multisite === true,
    language: normalizeEssentialProviderString(environment.language, 32),
    woocommerceVersion: normalizeEssentialProviderString(
      environment.version,
      32,
    ),
  };
  assertStructuredOutputWithinBudget(out);
  return out;
}
export function mapProductListResponse(
  data: unknown,
  headers: Headers,
  page: number,
) {
  if (!Array.isArray(data)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "WooCommerce returned an unexpected payload.",
    );
  }
  const products = data.map((item) => mapProductSummary(item));
  const pageInfo = readPagination(headers, page);
  const packed = packListWithinOutputBudget({ pageInfo }, "products", products);
  assertStructuredOutputWithinBudget(packed);
  return packed;
}
export function mapProductGetResponse(data: unknown) {
  const product = asRecord(data);
  const out = {
    ...mapProductSummary(product),
    description: normalizeTruncatableProviderString(
      product.description,
      OUTPUT_MAX_SHORT_DESCRIPTION,
    ),
    shortDescription: normalizeTruncatableProviderString(
      product.short_description,
      OUTPUT_MAX_SHORT_DESCRIPTION,
    ),
    categories: Array.isArray(product.categories)
      ? product.categories.map((entry) => {
          const cat = asRecord(entry);
          return {
            id: readIntId(cat.id, "category id"),
            name: normalizeEssentialProviderString(
              cat.name,
              OUTPUT_MAX_CATEGORY_NAME,
            ),
          };
        })
      : [],
    variationsPreview: Array.isArray(product.variations)
      ? product.variations.slice(0, VARIATIONS_PREVIEW_MAX)
      : [],
  };
  assertStructuredOutputWithinBudget(out);
  return out;
}
export function mapVariationListResponse(
  data: unknown,
  headers: Headers,
  page: number,
) {
  if (!Array.isArray(data)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "WooCommerce returned an unexpected payload.",
    );
  }
  const variations = data.map((item) => mapVariationSummary(item));
  const pageInfo = readPagination(headers, page);
  const packed = packListWithinOutputBudget(
    { pageInfo },
    "variations",
    variations,
  );
  assertStructuredOutputWithinBudget(packed);
  return packed;
}
export function mapCategoryListResponse(
  data: unknown,
  headers: Headers,
  page: number,
) {
  if (!Array.isArray(data)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "WooCommerce returned an unexpected payload.",
    );
  }
  const categories = data.map((item) => mapCategorySummary(item));
  const pageInfo = readPagination(headers, page);
  const packed = packListWithinOutputBudget(
    { pageInfo },
    "categories",
    categories,
  );
  assertStructuredOutputWithinBudget(packed);
  return packed;
}
export function mapCategoryGetResponse(data: unknown) {
  const category = asRecord(data);
  const out = {
    ...mapCategorySummary(category),
    description: normalizeTruncatableProviderString(
      category.description,
      OUTPUT_MAX_SHORT_DESCRIPTION,
    ),
  };
  assertStructuredOutputWithinBudget(out);
  return out;
}
export function mapOrderListResponse(
  data: unknown,
  headers: Headers,
  page: number,
  includePii: boolean,
) {
  if (!Array.isArray(data)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "WooCommerce returned an unexpected payload.",
    );
  }
  const orders = data.map((item) => stripOrderPii(asRecord(item), includePii));
  const pageInfo = readPagination(headers, page);
  const packed = packListWithinOutputBudget({ pageInfo }, "orders", orders);
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
export function mapVariationGetResponse(data: unknown) {
  const out = {
    ...mapVariationSummary(data),
    parentId: readIntId(asRecord(data).parent_id, "parent id"),
  };
  assertStructuredOutputWithinBudget(out);
  return out;
}
function mapOrderNoteSummary(raw: unknown, includePii: boolean) {
  const note = asRecord(raw);
  const customerNote = note.customer_note === true;
  const noteText = note.note;
  return {
    id: readIntId(note.id, "note id"),
    dateCreated: normalizeEssentialProviderString(note.date_created, 64),
    customerNote,
    note:
      includePii || !customerNote
        ? normalizeTruncatableProviderString(noteText, MAX_ORDER_NOTE_LENGTH)
        : "[REDACTED]",
  };
}
export function mapOrderNoteListResponse(
  data: unknown,
  headers: Headers,
  page: number,
  includePii: boolean,
) {
  if (!Array.isArray(data)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "WooCommerce returned an unexpected payload.",
    );
  }
  const notes = data.map((item) => mapOrderNoteSummary(item, includePii));
  const pageInfo = readPagination(headers, page);
  const packed = packListWithinOutputBudget({ pageInfo }, "notes", notes);
  assertStructuredOutputWithinBudget(packed);
  return packed;
}
