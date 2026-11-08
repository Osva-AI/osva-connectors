import { ConnectorSdkError } from "@osva-ai/connector-sdk";
const PRODUCT_STATUS = new Set(["draft", "pending", "private", "publish"]);
const CATALOG_VISIBILITY = new Set(["visible", "catalog", "search", "hidden"]);
const DEFAULT_ORDER_STATUSES = new Set([
  "pending",
  "processing",
  "on-hold",
  "completed",
  "cancelled",
  "refunded",
  "failed",
]);
export function buildWoocommerceProductUpdateBody(
  input: Record<string, unknown>,
  writableFields: ReadonlySet<string>,
) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!writableFields.has(key)) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        `Product field "${key}" is not allowed for update.`,
      );
    }
    out[key] = value;
  }
  if (Object.keys(out).length === 0) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Product update requires at least one allowed field.",
    );
  }
  if (out.status !== undefined) {
    if (typeof out.status !== "string" || !PRODUCT_STATUS.has(out.status)) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Product status value is not allowed.",
      );
    }
  }
  if (out.catalog_visibility !== undefined) {
    if (
      typeof out.catalog_visibility !== "string" ||
      !CATALOG_VISIBILITY.has(out.catalog_visibility)
    ) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Product catalog_visibility value is not allowed.",
      );
    }
  }
  for (const priceKey of ["regular_price", "sale_price"]) {
    const price = out[priceKey];
    if (price === undefined) {
      continue;
    }
    if (typeof price !== "string" || price.length === 0 || price.length > 32) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        `${priceKey} must be a decimal price string.`,
      );
    }
    if (!/^\d+(\.\d{1,8})?$/.test(price)) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        `${priceKey} must be a non-negative decimal string.`,
      );
    }
    if (price.startsWith("-")) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        `${priceKey} must not be negative.`,
      );
    }
  }
  return out;
}
export function buildWoocommerceOrderStatusBody(
  status: string,
  allowedTargets: string[] | undefined,
): Record<string, unknown> {
  const permitted =
    allowedTargets === undefined
      ? DEFAULT_ORDER_STATUSES
      : new Set(allowedTargets);
  if (allowedTargets !== undefined && permitted.size === 0) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Order target status allowlist is explicitly empty.",
    );
  }
  if (typeof status !== "string" || !permitted.has(status)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Order status is not an allowed target.",
    );
  }
  return { status };
}
