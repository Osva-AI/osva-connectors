import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  DEFAULT_API_VERSION,
  DEFAULT_REQUEST_TIMEOUT_MS,
  SHOPIFY_ACCESS_TOKEN_ENV,
  SHOPIFY_API_VERSION_ENV,
  SHOPIFY_SHOP_ENV,
  SHOPIFY_TIMEOUT_MS_ENV,
} from "./constants.js";
import { buildGraphqlEndpoint, parseShopHost } from "./parse-shop-host.js";
import { shopifyConfigSchema, type ShopifyConfig } from "./schemas.js";

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

export function loadShopifyConfig(
  env: NodeJS.ProcessEnv = process.env,
): ShopifyConfig {
  const rawShop = env[SHOPIFY_SHOP_ENV];
  const rawToken = env[SHOPIFY_ACCESS_TOKEN_ENV];

  if (rawShop === undefined || rawShop.trim().length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Shopify shop is not configured.",
    );
  }
  if (rawToken === undefined || rawToken.trim().length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Shopify access token is not configured.",
    );
  }

  let myshopifyDomain: string;
  try {
    myshopifyDomain = parseShopHost(rawShop).myshopifyDomain;
  } catch {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Shopify shop identifier is not valid.",
    );
  }

  const apiVersionRaw = env[SHOPIFY_API_VERSION_ENV];
  const apiVersion =
    apiVersionRaw === undefined || apiVersionRaw.trim().length === 0
      ? DEFAULT_API_VERSION
      : apiVersionRaw.trim();

  const requestTimeoutMs = readBoundedInt(
    env[SHOPIFY_TIMEOUT_MS_ENV],
    DEFAULT_REQUEST_TIMEOUT_MS,
    "Request timeout",
  );

  const parsed = shopifyConfigSchema.safeParse({
    myshopifyDomain,
    accessToken: rawToken.trim(),
    apiVersion,
    requestTimeoutMs,
    graphqlEndpoint: buildGraphqlEndpoint(myshopifyDomain, apiVersion),
  });

  if (!parsed.success) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Shopify connector configuration is invalid.",
    );
  }

  return parsed.data;
}
