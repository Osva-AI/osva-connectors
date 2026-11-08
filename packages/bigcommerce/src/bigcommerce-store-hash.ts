import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { MAX_STORE_HASH_LENGTH } from "./constants.js";

const STORE_HASH_PATTERN = /^[a-z0-9]+$/;

export function parseBigcommerceStoreHash(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_STORE_HASH_LENGTH) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "BigCommerce store hash is not valid.",
    );
  }
  if (!STORE_HASH_PATTERN.test(trimmed)) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "BigCommerce store hash is not valid.",
    );
  }
  return trimmed;
}

export function parseBigcommerceApiHost(
  raw: string | undefined,
  defaultHost: string,
): string {
  const host =
    raw === undefined || raw.trim().length === 0 ? defaultHost : raw.trim();
  let parsed: URL;
  try {
    parsed = new URL(host);
  } catch {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "BigCommerce API host is not valid.",
    );
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "BigCommerce API host must use HTTP or HTTPS.",
    );
  }
  return parsed.origin;
}
