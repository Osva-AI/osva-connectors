import { ConnectorSdkError } from "@osva-ai/connector-sdk";
const DEFAULT_ORDER_STATUS_IDS = new Set([
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
]);
export function buildBigcommerceProductUpdateBody(
  input: Record<string, unknown>,
) {
  const allowed = new Set(["price", "sale_price", "is_visible"]);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!allowed.has(key)) {
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
  if (out.is_visible !== undefined && typeof out.is_visible !== "boolean") {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Product is_visible must be a boolean.",
    );
  }
  for (const priceKey of ["price", "sale_price"]) {
    const price = out[priceKey];
    if (price === undefined) {
      continue;
    }
    if (typeof price !== "number" || !Number.isFinite(price) || price < 0) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        `${priceKey} must be a non-negative number.`,
      );
    }
  }
  if (out.availability !== undefined) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Inventory and availability mutations are not supported in this connector.",
    );
  }
  return out;
}
export function buildBigcommerceOrderStatusBody(
  statusId: number,
  allowedTargets: number[] | undefined,
): { status_id: number } {
  const permitted =
    allowedTargets === undefined
      ? DEFAULT_ORDER_STATUS_IDS
      : new Set(allowedTargets);
  if (allowedTargets !== undefined && permitted.size === 0) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Order target status allowlist is explicitly empty.",
    );
  }
  if (!permitted.has(statusId)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Order status_id is not an allowed target.",
    );
  }
  return { status_id: statusId };
}
