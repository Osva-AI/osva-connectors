import { ConnectorSdkError } from "@osva-ai/connector-sdk";

const GID_PREFIX = "gid://shopify/";

export type ShopifyGidResource =
  "Product" | "Order" | "Location" | "InventoryItem";

const GID_PATTERN =
  /^gid:\/\/shopify\/(Product|Order|Location|InventoryItem)\/\d+$/;

export const GID_INPUT_PATTERN = {
  product: /^gid:\/\/shopify\/Product\/\d+$/,
  order: /^gid:\/\/shopify\/Order\/\d+$/,
  location: /^gid:\/\/shopify\/Location\/\d+$/,
  inventoryItem: /^gid:\/\/shopify\/InventoryItem\/\d+$/,
} as const;

export function parseShopifyGid(
  raw: string,
  resource: ShopifyGidResource,
): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 128) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Invalid Shopify resource ID.",
    );
  }
  if (!GID_PATTERN.test(trimmed)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Invalid Shopify resource ID.",
    );
  }
  const expectedPrefix = `${GID_PREFIX}${resource}/`;
  if (!trimmed.startsWith(expectedPrefix)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Invalid Shopify resource ID.",
    );
  }
  return trimmed;
}
