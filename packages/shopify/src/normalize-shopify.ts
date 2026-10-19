import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { VARIANTS_PREVIEW_MAX, LINE_ITEMS_PREVIEW_MAX } from "./constants.js";
import {
  assertStructuredOutputWithinBudget,
  normalizeEssentialProviderString,
  normalizeTruncatableProviderString,
  packListWithinOutputBudget,
  type ListPageInfo,
  OUTPUT_MAX_GID_LENGTH,
  OUTPUT_MAX_HANDLE_LENGTH,
  OUTPUT_MAX_ISO_TIMESTAMP,
  OUTPUT_MAX_MONEY_AMOUNT_LENGTH,
  OUTPUT_MAX_PRODUCT_TITLE,
  OUTPUT_MAX_SHOP_NAME,
  OUTPUT_MAX_SKU_LENGTH,
  OUTPUT_MAX_TIMEZONE_LENGTH,
  OUTPUT_MAX_VENDOR_LENGTH,
} from "./output-budget.js";

function asRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Shopify returned an unexpected payload.",
    );
  }
  return value as Record<string, unknown>;
}

function readNodes(parent: Record<string, unknown>, key: string): unknown[] {
  const connection = parent[key];
  if (connection === null || connection === undefined) {
    return [];
  }
  const record = asRecord(connection);
  const nodes = record["nodes"];
  if (!Array.isArray(nodes)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Shopify returned an unexpected payload.",
    );
  }
  return nodes;
}

function readPageInfo(parent: Record<string, unknown>): ListPageInfo {
  const connection = parent;
  const pageInfoRaw = connection["pageInfo"];
  if (pageInfoRaw === null || pageInfoRaw === undefined) {
    return { hasNextPage: false };
  }
  const pageInfo = asRecord(pageInfoRaw);
  const hasNextPage = pageInfo["hasNextPage"] === true;
  const endCursorRaw = pageInfo["endCursor"];
  if (endCursorRaw === null || endCursorRaw === undefined) {
    return { hasNextPage };
  }
  const endCursor = normalizeEssentialProviderString(
    endCursorRaw,
    512,
    "Shopify returned an invalid pagination cursor.",
  );
  return hasNextPage ? { hasNextPage, endCursor } : { hasNextPage };
}

function normalizeGid(value: unknown): string {
  return normalizeEssentialProviderString(
    value,
    OUTPUT_MAX_GID_LENGTH,
    "Shopify returned an invalid resource ID.",
  );
}

function normalizeTimestamp(value: unknown): string {
  return normalizeEssentialProviderString(
    value,
    OUTPUT_MAX_ISO_TIMESTAMP,
    "Shopify returned an invalid timestamp.",
  );
}

function normalizeMoneyAmount(value: unknown): string {
  return normalizeEssentialProviderString(
    value,
    OUTPUT_MAX_MONEY_AMOUNT_LENGTH,
    "Shopify returned an invalid money amount.",
  );
}

function normalizeVariantPreview(variantRaw: unknown): {
  id: string;
  title: string;
  sku: string | null;
  price: string;
} {
  const variant = asRecord(variantRaw);
  const skuRaw = variant["sku"];
  let sku: string | null = null;
  if (skuRaw !== null && skuRaw !== undefined) {
    const skuResult = normalizeTruncatableProviderString(
      skuRaw,
      OUTPUT_MAX_SKU_LENGTH,
    );
    sku = skuResult.value.length > 0 ? skuResult.value : null;
  }
  const titleResult = normalizeTruncatableProviderString(
    variant["title"],
    OUTPUT_MAX_PRODUCT_TITLE,
  );
  return {
    id: normalizeGid(variant["id"]),
    title: titleResult.value,
    sku,
    price: normalizeMoneyAmount(variant["price"]),
  };
}

function mapVariantsPreview(variantsConnection: unknown): {
  variants: ReturnType<typeof normalizeVariantPreview>[];
  variantsPreviewComplete: boolean;
} {
  if (variantsConnection === null || variantsConnection === undefined) {
    return { variants: [], variantsPreviewComplete: true };
  }
  const connection = asRecord(variantsConnection);
  const nodes = connection["nodes"];
  if (!Array.isArray(nodes)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Shopify returned an unexpected product variant payload.",
    );
  }
  const limited = nodes.slice(0, VARIANTS_PREVIEW_MAX);
  const variants = limited.map((node) => normalizeVariantPreview(node));
  const pageInfoRaw = connection["pageInfo"];
  let hasMore = nodes.length > VARIANTS_PREVIEW_MAX;
  if (pageInfoRaw !== null && pageInfoRaw !== undefined) {
    const pageInfo = asRecord(pageInfoRaw);
    if (pageInfo["hasNextPage"] === true) {
      hasMore = true;
    }
  }
  return {
    variants,
    variantsPreviewComplete: !hasMore,
  };
}

export function mapShopGetResponse(data: unknown): {
  id: string;
  name: string;
  myshopifyDomain: string;
  currencyCode: string;
  ianaTimezone: string;
} {
  const root = asRecord(data);
  const shop = root["shop"];
  if (shop === null || shop === undefined) {
    throw new ConnectorSdkError("NOT_FOUND", "Shopify shop was not found.");
  }
  const record = asRecord(shop);
  const nameResult = normalizeTruncatableProviderString(
    record["name"],
    OUTPUT_MAX_SHOP_NAME,
  );
  const domain = normalizeEssentialProviderString(
    record["myshopifyDomain"],
    OUTPUT_MAX_SHOP_NAME,
    "Shopify returned an invalid shop domain.",
  );
  const timezone = normalizeEssentialProviderString(
    record["ianaTimezone"],
    OUTPUT_MAX_TIMEZONE_LENGTH,
    "Shopify returned an invalid timezone.",
  );
  const output = {
    id: normalizeGid(record["id"]),
    name: nameResult.value,
    myshopifyDomain: domain,
    currencyCode: normalizeEssentialProviderString(
      record["currencyCode"],
      16,
      "Shopify returned an invalid currency code.",
    ),
    ianaTimezone: timezone,
    ...(nameResult.truncated ? { nameTruncated: true as const } : {}),
  };
  assertStructuredOutputWithinBudget(output);
  return output;
}

function mapProductSummary(productRaw: unknown): Record<string, unknown> {
  const product = asRecord(productRaw);
  const titleResult = normalizeTruncatableProviderString(
    product["title"],
    OUTPUT_MAX_PRODUCT_TITLE,
  );
  const vendorResult = normalizeTruncatableProviderString(
    product["vendor"],
    OUTPUT_MAX_VENDOR_LENGTH,
  );
  const { variants, variantsPreviewComplete } = mapVariantsPreview(
    product["variants"],
  );
  return {
    id: normalizeGid(product["id"]),
    title: titleResult.value,
    handle: normalizeEssentialProviderString(
      product["handle"],
      OUTPUT_MAX_HANDLE_LENGTH,
      "Shopify returned an invalid product handle.",
    ),
    status: normalizeEssentialProviderString(product["status"], 32),
    vendor: vendorResult.value,
    productType: normalizeTruncatableProviderString(
      product["productType"],
      OUTPUT_MAX_VENDOR_LENGTH,
    ).value,
    createdAt: normalizeTimestamp(product["createdAt"]),
    updatedAt: normalizeTimestamp(product["updatedAt"]),
    variants,
    variantsPreviewComplete,
    ...(titleResult.truncated ? { titleTruncated: true as const } : {}),
    ...(vendorResult.truncated ? { vendorTruncated: true as const } : {}),
  };
}

export function mapProductListResponse(data: unknown): {
  products: Record<string, unknown>[];
  pageInfo: ListPageInfo;
} {
  const root = asRecord(data);
  const connection = asRecord(root["products"] ?? {});
  const nodes = readNodes(root, "products");
  const products = nodes.map((node) => mapProductSummary(node));
  const pageInfo = readPageInfo(connection);
  const packed = packListWithinOutputBudget({ pageInfo }, "products", products);
  const output = {
    pageInfo: packed.pageInfo,
    products: packed.products as Record<string, unknown>[],
    ...(packed.productsTruncated === true
      ? { productsTruncated: true as const }
      : {}),
  };
  assertStructuredOutputWithinBudget(output);
  return output;
}

export function mapProductGetResponse(data: unknown): Record<string, unknown> {
  const root = asRecord(data);
  const product = root["product"];
  if (product === null || product === undefined) {
    throw new ConnectorSdkError("NOT_FOUND", "Shopify product was not found.");
  }
  const record = asRecord(product);
  const summary = mapProductSummary(record);
  const descriptionResult = normalizeTruncatableProviderString(
    record["description"],
    4096,
  );
  const tagsRaw = record["tags"];
  let tags: string[] = [];
  if (Array.isArray(tagsRaw)) {
    tags = tagsRaw
      .filter((tag): tag is string => typeof tag === "string")
      .slice(0, 50)
      .map((tag) => normalizeTruncatableProviderString(tag, 128).value);
  }
  const output = {
    ...summary,
    description: descriptionResult.value,
    tags,
    ...(descriptionResult.truncated
      ? { descriptionTruncated: true as const }
      : {}),
  };
  assertStructuredOutputWithinBudget(output);
  return output;
}

function mapOrderSummary(orderRaw: unknown): Record<string, unknown> {
  const order = asRecord(orderRaw);
  const totalSet = asRecord(order["currentTotalPriceSet"] ?? {});
  const shopMoney = asRecord(totalSet["shopMoney"] ?? {});
  return {
    id: normalizeGid(order["id"]),
    name: normalizeEssentialProviderString(order["name"], 64),
    createdAt: normalizeTimestamp(order["createdAt"]),
    updatedAt: normalizeTimestamp(order["updatedAt"]),
    displayFinancialStatus:
      order["displayFinancialStatus"] === null ||
      order["displayFinancialStatus"] === undefined
        ? null
        : normalizeEssentialProviderString(order["displayFinancialStatus"], 64),
    displayFulfillmentStatus: normalizeEssentialProviderString(
      order["displayFulfillmentStatus"],
      64,
    ),
    totalPrice: normalizeMoneyAmount(shopMoney["amount"]),
    currencyCode: normalizeEssentialProviderString(
      shopMoney["currencyCode"] ?? order["currencyCode"],
      16,
    ),
  };
}

export function mapOrderListResponse(data: unknown): {
  orders: Record<string, unknown>[];
  pageInfo: ListPageInfo;
} {
  const root = asRecord(data);
  const connection = asRecord(root["orders"] ?? {});
  const nodes = readNodes(root, "orders");
  const orders = nodes.map((node) => mapOrderSummary(node));
  const pageInfo = readPageInfo(connection);
  const packed = packListWithinOutputBudget({ pageInfo }, "orders", orders);
  const output = {
    pageInfo: packed.pageInfo,
    orders: packed.orders as Record<string, unknown>[],
    ...(packed.ordersTruncated === true
      ? { ordersTruncated: true as const }
      : {}),
  };
  assertStructuredOutputWithinBudget(output);
  return output;
}

function mapLineItemPreview(lineItemRaw: unknown): Record<string, unknown> {
  const item = asRecord(lineItemRaw);
  const nameResult = normalizeTruncatableProviderString(
    item["name"],
    OUTPUT_MAX_PRODUCT_TITLE,
  );
  const skuRaw = item["sku"];
  let sku: string | null = null;
  if (skuRaw !== null && skuRaw !== undefined) {
    sku = normalizeTruncatableProviderString(
      skuRaw,
      OUTPUT_MAX_SKU_LENGTH,
    ).value;
  }
  const quantity = Number(item["quantity"]);
  const currentQuantity = Number(item["currentQuantity"]);
  if (
    !Number.isFinite(quantity) ||
    !Number.isInteger(quantity) ||
    !Number.isFinite(currentQuantity) ||
    !Number.isInteger(currentQuantity)
  ) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Shopify returned an invalid line item quantity.",
    );
  }
  return {
    id: normalizeGid(item["id"]),
    name: nameResult.value,
    quantity,
    currentQuantity,
    sku,
    ...(nameResult.truncated ? { nameTruncated: true as const } : {}),
  };
}

export function mapOrderGetResponse(data: unknown): Record<string, unknown> {
  const root = asRecord(data);
  const order = root["order"];
  if (order === null || order === undefined) {
    throw new ConnectorSdkError("NOT_FOUND", "Shopify order was not found.");
  }
  const record = asRecord(order);
  const summary = mapOrderSummary(record);

  const subtotalSet = asRecord(record["currentSubtotalPriceSet"] ?? {});
  const taxSet = asRecord(record["currentTotalTaxSet"] ?? {});
  const subtotalMoney = asRecord(subtotalSet["shopMoney"] ?? {});
  const taxMoney = asRecord(taxSet["shopMoney"] ?? {});

  const lineItemsConnection = record["lineItems"];
  let lineItems: Record<string, unknown>[] = [];
  let lineItemsPreviewComplete = true;
  if (lineItemsConnection !== null && lineItemsConnection !== undefined) {
    const connection = asRecord(lineItemsConnection);
    const nodes = connection["nodes"];
    if (!Array.isArray(nodes)) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Shopify returned an unexpected line item payload.",
      );
    }
    const limited = nodes.slice(0, LINE_ITEMS_PREVIEW_MAX);
    lineItems = limited.map((node) => mapLineItemPreview(node));
    const pageInfo = connection["pageInfo"];
    if (pageInfo !== null && pageInfo !== undefined) {
      const pi = asRecord(pageInfo);
      if (pi["hasNextPage"] === true || nodes.length > LINE_ITEMS_PREVIEW_MAX) {
        lineItemsPreviewComplete = false;
      }
    }
  }

  const output = {
    ...summary,
    subtotalPrice: normalizeMoneyAmount(subtotalMoney["amount"]),
    totalTax: normalizeMoneyAmount(taxMoney["amount"]),
    lineItems,
    lineItemsPreviewComplete,
  };
  assertStructuredOutputWithinBudget(output);
  return output;
}

export function mapLocationListResponse(data: unknown): {
  locations: Record<string, unknown>[];
  pageInfo: ListPageInfo;
} {
  const root = asRecord(data);
  const connection = asRecord(root["locations"] ?? {});
  const nodes = readNodes(root, "locations");
  const locations = nodes.map((node) => {
    const record = asRecord(node);
    const nameResult = normalizeTruncatableProviderString(
      record["name"],
      OUTPUT_MAX_SHOP_NAME,
    );
    return {
      id: normalizeGid(record["id"]),
      name: nameResult.value,
      isActive: record["isActive"] === true,
      fulfillsOnlineOrders: record["fulfillsOnlineOrders"] === true,
      ...(nameResult.truncated ? { nameTruncated: true as const } : {}),
    };
  });
  const pageInfo = readPageInfo(connection);
  const packed = packListWithinOutputBudget(
    { pageInfo },
    "locations",
    locations,
  );
  const output = {
    pageInfo: packed.pageInfo,
    locations: packed.locations as Record<string, unknown>[],
    ...(packed.locationsTruncated === true
      ? { locationsTruncated: true as const }
      : {}),
  };
  assertStructuredOutputWithinBudget(output);
  return output;
}

function normalizeQuantities(
  raw: unknown,
): { name: string; quantity: number }[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((entry) => {
      const record = asRecord(entry);
      const name = normalizeEssentialProviderString(record["name"], 32);
      const quantity = Number(record["quantity"]);
      if (!Number.isFinite(quantity)) {
        throw new ConnectorSdkError(
          "PROVIDER_ERROR",
          "Shopify returned an invalid inventory quantity.",
        );
      }
      return { name, quantity };
    })
    .slice(0, 10);
}

export function mapInventoryLevelsResponse(
  data: unknown,
  filter?: { locationId?: string; inventoryItemId?: string },
): {
  inventoryLevels: Record<string, unknown>[];
  pageInfo: ListPageInfo;
} {
  const root = asRecord(data);
  const location = root["location"];
  const inventoryItem = root["inventoryItem"];

  let connection: Record<string, unknown> | undefined;
  if (location !== undefined) {
    if (location === null) {
      throw new ConnectorSdkError(
        "NOT_FOUND",
        "Shopify location was not found.",
      );
    }
    const loc = asRecord(location);
    if (
      loc["inventoryLevels"] === null ||
      loc["inventoryLevels"] === undefined
    ) {
      throw new ConnectorSdkError(
        "NOT_FOUND",
        "Shopify location was not found.",
      );
    }
    connection = asRecord(loc["inventoryLevels"]);
  } else if (inventoryItem !== undefined) {
    if (inventoryItem === null) {
      throw new ConnectorSdkError(
        "NOT_FOUND",
        "Shopify inventory item was not found.",
      );
    }
    const item = asRecord(inventoryItem);
    if (
      item["inventoryLevels"] === null ||
      item["inventoryLevels"] === undefined
    ) {
      throw new ConnectorSdkError(
        "NOT_FOUND",
        "Shopify inventory item was not found.",
      );
    }
    connection = asRecord(item["inventoryLevels"]);
  } else {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Shopify returned an unexpected inventory payload.",
    );
  }

  const nodes = connection["nodes"];
  if (!Array.isArray(nodes)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Shopify returned an unexpected inventory payload.",
    );
  }

  let mapped = nodes.map((node) => {
    const record = asRecord(node);
    const item = asRecord(record["item"] ?? {});
    const loc = asRecord(record["location"] ?? {});
    const quantities = normalizeQuantities(record["quantities"]);
    const availableEntry = quantities.find((q) => q.name === "available");
    return {
      inventoryItemId: normalizeGid(item["id"]),
      locationId: normalizeGid(loc["id"]),
      available: availableEntry !== undefined ? availableEntry.quantity : null,
      quantities,
    };
  });

  if (
    filter?.locationId !== undefined &&
    filter.inventoryItemId !== undefined
  ) {
    mapped = mapped.filter(
      (level) =>
        level.locationId === filter.locationId &&
        level.inventoryItemId === filter.inventoryItemId,
    );
  } else if (filter?.locationId !== undefined) {
    mapped = mapped.filter((level) => level.locationId === filter.locationId);
  }

  const pageInfo = readPageInfo(connection);
  const packed = packListWithinOutputBudget(
    { pageInfo },
    "inventoryLevels",
    mapped,
  );
  const output = {
    pageInfo: packed.pageInfo,
    inventoryLevels: packed.inventoryLevels as Record<string, unknown>[],
    ...(packed.inventoryLevelsTruncated === true
      ? { inventoryLevelsTruncated: true as const }
      : {}),
  };
  assertStructuredOutputWithinBudget(output);
  return output;
}
