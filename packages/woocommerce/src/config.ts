import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_WRITABLE_PRODUCT_FIELDS,
  WOOCOMMERCE_ALLOW_LOCAL_HTTP_ENV,
  WOOCOMMERCE_ALLOWED_ORDER_IDS_ENV,
  WOOCOMMERCE_ALLOWED_ORDER_TARGET_STATUSES_ENV,
  WOOCOMMERCE_ALLOWED_PRODUCT_IDS_ENV,
  WOOCOMMERCE_CONSUMER_KEY_ENV,
  WOOCOMMERCE_CONSUMER_SECRET_ENV,
  WOOCOMMERCE_HOST_WRITES_APPROVED_ENV,
  WOOCOMMERCE_INCLUDE_ORDER_PII_ENV,
  WOOCOMMERCE_STORE_URL_ENV,
  WOOCOMMERCE_TIMEOUT_MS_ENV,
  WOOCOMMERCE_WRITABLE_PRODUCT_FIELDS_ENV,
  WOOCOMMERCE_WRITE_ENABLED_ENV,
} from "./constants.js";
import { parseNumericIdList } from "./id-allowlist.js";
import { woocommerceConfigSchema, type WoocommerceConfig } from "./schemas.js";
import { parseWoocommerceStoreUrl } from "./woocommerce-base-url.js";

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

function parseCsvStrings(raw: string | undefined): string[] | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (raw.trim().length === 0) {
    return [];
  }
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function parseWritableProductFields(raw: string | undefined): string[] {
  const parsed = parseCsvStrings(raw);
  if (parsed === undefined) {
    return [...DEFAULT_WRITABLE_PRODUCT_FIELDS];
  }
  if (parsed.length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Writable product fields allowlist must not be empty when set.",
    );
  }
  return parsed;
}

export function loadWoocommerceConfig(
  env: NodeJS.ProcessEnv = process.env,
): WoocommerceConfig {
  const rawUrl = env[WOOCOMMERCE_STORE_URL_ENV];
  const rawKey = env[WOOCOMMERCE_CONSUMER_KEY_ENV];
  const rawSecret = env[WOOCOMMERCE_CONSUMER_SECRET_ENV];
  if (rawUrl === undefined || rawUrl.trim().length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "WooCommerce store URL is not configured.",
    );
  }
  if (rawKey === undefined || rawKey.trim().length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "WooCommerce consumer key is not configured.",
    );
  }
  if (rawSecret === undefined || rawSecret.trim().length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "WooCommerce consumer secret is not configured.",
    );
  }
  const allowLocalHttp = parseBooleanFlag(
    env[WOOCOMMERCE_ALLOW_LOCAL_HTTP_ENV],
    false,
  );
  const { apiBaseUrl, pinnedOrigin } = parseWoocommerceStoreUrl(
    rawUrl,
    allowLocalHttp,
  );
  const parsed = woocommerceConfigSchema.safeParse({
    apiBaseUrl,
    pinnedOrigin,
    consumerKey: rawKey.trim(),
    consumerSecret: rawSecret.trim(),
    allowLocalHttp,
    allowedProductIds: parseNumericIdList(
      env[WOOCOMMERCE_ALLOWED_PRODUCT_IDS_ENV],
    ),
    allowedOrderIds: parseNumericIdList(env[WOOCOMMERCE_ALLOWED_ORDER_IDS_ENV]),
    allowedOrderTargetStatuses: parseCsvStrings(
      env[WOOCOMMERCE_ALLOWED_ORDER_TARGET_STATUSES_ENV],
    ),
    writableProductFields: parseWritableProductFields(
      env[WOOCOMMERCE_WRITABLE_PRODUCT_FIELDS_ENV],
    ),
    writeEnabled: parseBooleanFlag(env[WOOCOMMERCE_WRITE_ENABLED_ENV], false),
    hostWritesApproved: parseBooleanFlag(
      env[WOOCOMMERCE_HOST_WRITES_APPROVED_ENV],
      false,
    ),
    includeOrderPii: parseBooleanFlag(
      env[WOOCOMMERCE_INCLUDE_ORDER_PII_ENV],
      false,
    ),
    requestTimeoutMs: readBoundedInt(
      env[WOOCOMMERCE_TIMEOUT_MS_ENV],
      DEFAULT_REQUEST_TIMEOUT_MS,
      "Request timeout",
    ),
  });
  if (!parsed.success) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "WooCommerce connector configuration is invalid.",
    );
  }
  return parsed.data;
}
