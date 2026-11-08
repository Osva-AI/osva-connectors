import { ConnectorSdkError } from "@osva-ai/connector-sdk";

const WC_V3_SUFFIX = "/wp-json/wc/v3";

export interface WoocommerceStoreUrlParseResult {
  readonly apiBaseUrl: string;
  readonly pinnedOrigin: string;
}

export function parseWoocommerceStoreUrl(
  raw: string,
  allowLocalHttp: boolean,
): WoocommerceStoreUrlParseResult {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "WooCommerce store URL is empty.",
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "WooCommerce store URL is not valid.",
    );
  }
  if (parsed.username.length > 0 || parsed.password.length > 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "WooCommerce store URL must not include credentials.",
    );
  }
  if (parsed.search.length > 0 || parsed.hash.length > 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "WooCommerce store URL must not include query strings or fragments.",
    );
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "WooCommerce store URL must use HTTP or HTTPS.",
    );
  }
  const isLoopback =
    parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol === "http:" && !allowLocalHttp && !isLoopback) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "WooCommerce requires HTTPS unless OSVA_CONNECTOR_WOOCOMMERCE_ALLOW_LOCAL_HTTP=true.",
    );
  }
  let pathname = parsed.pathname.replace(/\/$/, "");
  if (!pathname.endsWith("/wc/v3")) {
    if (pathname.length === 0 || pathname === "/") {
      pathname = WC_V3_SUFFIX;
    } else if (!pathname.endsWith("/wp-json/wc/v3")) {
      pathname = `${pathname}${WC_V3_SUFFIX}`;
    }
  }
  parsed.pathname = pathname;
  parsed.search = "";
  parsed.hash = "";
  const apiBaseUrl = parsed.toString().replace(/\/$/, "");
  const pinnedOrigin = parsed.origin;
  return { apiBaseUrl, pinnedOrigin };
}
