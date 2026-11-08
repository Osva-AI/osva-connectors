import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  BIGCOMMERCE_ACCESS_TOKEN_ENV,
  BIGCOMMERCE_ALLOWED_CATEGORY_TREE_IDS_ENV,
  BIGCOMMERCE_ALLOWED_ORDER_IDS_ENV,
  BIGCOMMERCE_ALLOWED_ORDER_TARGET_STATUS_IDS_ENV,
  BIGCOMMERCE_ALLOWED_PRODUCT_IDS_ENV,
  BIGCOMMERCE_ALLOW_TEST_API_HOST_ENV,
  BIGCOMMERCE_HOST_WRITES_APPROVED_ENV,
  BIGCOMMERCE_INCLUDE_ORDER_PII_ENV,
  BIGCOMMERCE_STORE_HASH_ENV,
  BIGCOMMERCE_TIMEOUT_MS_ENV,
  BIGCOMMERCE_WRITE_ENABLED_ENV,
  DEFAULT_REQUEST_TIMEOUT_MS,
  PRODUCTION_API_HOST,
} from "./constants.js";
import { parseBigcommerceStoreHash } from "./bigcommerce-store-hash.js";
import { parseNumericIdList } from "./id-allowlist.js";
import { bigcommerceConfigSchema, type BigcommerceConfig } from "./schemas.js";

function readBoundedInt(
  raw: string | undefined,
  fallback: number,
  label: string,
): number {
  if (raw === undefined || raw.trim().length === 0) {
    return fallback;
  }
  const value = Number(raw.trim());
  if (!Number.isInteger(value)) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      `${label} must be an integer.`,
    );
  }
  return value;
}

function parseBooleanFlag(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined || raw.trim().length === 0) {
    return fallback;
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }
  throw new ConnectorSdkError(
    "CONFIGURATION_ERROR",
    "Boolean environment flag must be true or false.",
  );
}

function parseStatusIdList(raw: string | undefined): number[] | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (raw.trim().length === 0) {
    return [];
  }
  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  const out: number[] = [];
  const seen = new Set<number>();
  for (const part of parts) {
    const value = Number.parseInt(part, 10);
    if (!Number.isInteger(value) || value < 0) {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        "Order status ID allowlist must be non-negative integers.",
      );
    }
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    out.push(value);
  }
  return out;
}

function resolveApiHost(env: NodeJS.ProcessEnv): string {
  const allowTest = parseBooleanFlag(
    env[BIGCOMMERCE_ALLOW_TEST_API_HOST_ENV],
    false,
  );
  const override = env.OSVA_CONNECTOR_BIGCOMMERCE_API_HOST?.trim();
  if (override !== undefined && override.length > 0) {
    if (!allowTest) {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        "BigCommerce API host override requires OSVA_CONNECTOR_BIGCOMMERCE_ALLOW_TEST_API_HOST=true.",
      );
    }
    return new URL(override).origin;
  }
  return PRODUCTION_API_HOST;
}

export function loadBigcommerceConfig(
  env: NodeJS.ProcessEnv = process.env,
): BigcommerceConfig {
  const rawHash = env[BIGCOMMERCE_STORE_HASH_ENV];
  const rawToken = env[BIGCOMMERCE_ACCESS_TOKEN_ENV];
  if (rawHash === undefined || rawHash.trim().length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "BigCommerce store hash is not configured.",
    );
  }
  if (rawToken === undefined || rawToken.trim().length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "BigCommerce access token is not configured.",
    );
  }
  const apiHost = resolveApiHost(env);
  const parsed = bigcommerceConfigSchema.safeParse({
    apiHost,
    storeHash: parseBigcommerceStoreHash(rawHash),
    accessToken: rawToken.trim(),
    allowedProductIds: parseNumericIdList(
      env[BIGCOMMERCE_ALLOWED_PRODUCT_IDS_ENV],
    ),
    allowedOrderIds: parseNumericIdList(env[BIGCOMMERCE_ALLOWED_ORDER_IDS_ENV]),
    allowedCategoryTreeIds: parseNumericIdList(
      env[BIGCOMMERCE_ALLOWED_CATEGORY_TREE_IDS_ENV],
    ),
    allowedOrderTargetStatusIds: parseStatusIdList(
      env[BIGCOMMERCE_ALLOWED_ORDER_TARGET_STATUS_IDS_ENV],
    ),
    writeEnabled: parseBooleanFlag(env[BIGCOMMERCE_WRITE_ENABLED_ENV], false),
    hostWritesApproved: parseBooleanFlag(
      env[BIGCOMMERCE_HOST_WRITES_APPROVED_ENV],
      false,
    ),
    includeOrderPii: parseBooleanFlag(
      env[BIGCOMMERCE_INCLUDE_ORDER_PII_ENV],
      false,
    ),
    requestTimeoutMs: readBoundedInt(
      env[BIGCOMMERCE_TIMEOUT_MS_ENV],
      DEFAULT_REQUEST_TIMEOUT_MS,
      "Request timeout",
    ),
  });
  if (!parsed.success) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "BigCommerce connector configuration is invalid.",
    );
  }
  return parsed.data;
}
