const MYSHOPIFY_SUFFIX = ".myshopify.com";

/** Shopify store handle (subdomain) before .myshopify.com */
const SHOP_HANDLE_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9-]*$/;

function isIpv4(hostname: string): boolean {
  const parts = hostname.split(".");
  if (parts.length !== 4) {
    return false;
  }
  return parts.every((part) => {
    if (!/^\d+$/.test(part)) {
      return false;
    }
    const n = Number(part);
    return n >= 0 && n <= 255;
  });
}

function isIpv6(hostname: string): boolean {
  return hostname.includes(":");
}

function normalizeHandle(handle: string): string {
  return handle.toLowerCase();
}

function assertValidShopHandle(handle: string): string {
  const normalized = normalizeHandle(handle);
  if (normalized.length === 0 || normalized.length > 63) {
    throw new Error("Invalid shop identifier.");
  }
  if (!SHOP_HANDLE_PATTERN.test(normalized)) {
    throw new Error("Invalid shop identifier.");
  }
  if (normalized.endsWith("-")) {
    throw new Error("Invalid shop identifier.");
  }
  return normalized;
}

function hostnameFromMyshopifyDomain(hostname: string): string {
  const lower = hostname.toLowerCase();
  if (lower === MYSHOPIFY_SUFFIX.slice(1)) {
    throw new Error("Invalid shop hostname.");
  }
  if (!lower.endsWith(MYSHOPIFY_SUFFIX)) {
    throw new Error("Shop hostname must be a myshopify.com store domain.");
  }
  const handle = lower.slice(0, -MYSHOPIFY_SUFFIX.length);
  assertValidShopHandle(handle);
  return `${handle}${MYSHOPIFY_SUFFIX}`;
}

export interface ParsedShopHost {
  /** Canonical HTTPS admin host, e.g. example.myshopify.com */
  readonly myshopifyDomain: string;
}

/**
 * Validates shop configuration and returns the canonical myshopify.com hostname.
 * Rejects URLs with paths, query strings, credentials, non-HTTPS schemes, ports, and IP hosts.
 */
export function parseShopHost(raw: string): ParsedShopHost {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new Error("Shop is required.");
  }

  if (
    trimmed.includes("@") ||
    trimmed.includes("?") ||
    trimmed.includes("#") ||
    trimmed.includes("\\")
  ) {
    throw new Error(
      "Shop value must not include credentials or URL fragments.",
    );
  }

  if (trimmed.includes("://")) {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      throw new Error("Shop URL is not valid.");
    }
    if (url.protocol !== "https:") {
      throw new Error("Shop URL must use HTTPS.");
    }
    if (url.username.length > 0 || url.password.length > 0) {
      throw new Error("Shop URL must not include credentials.");
    }
    if (url.pathname !== "/" && url.pathname.length > 0) {
      throw new Error("Shop URL must not include a path.");
    }
    if (url.search.length > 0 || url.hash.length > 0) {
      throw new Error("Shop URL must not include query or fragment.");
    }
    if (url.port.length > 0 && url.port !== "443") {
      throw new Error("Shop URL must not include a non-default port.");
    }
    const hostname = url.hostname;
    if (isIpv4(hostname) || isIpv6(hostname)) {
      throw new Error("Shop hostname must not be an IP address.");
    }
    return { myshopifyDomain: hostnameFromMyshopifyDomain(hostname) };
  }

  if (trimmed.includes("/")) {
    throw new Error("Shop value must not include a path.");
  }

  const lower = trimmed.toLowerCase();
  if (lower.includes(MYSHOPIFY_SUFFIX)) {
    if (isIpv4(lower) || isIpv6(lower)) {
      throw new Error("Shop hostname must not be an IP address.");
    }
    return { myshopifyDomain: hostnameFromMyshopifyDomain(lower) };
  }

  const handle = assertValidShopHandle(lower);
  return { myshopifyDomain: `${handle}${MYSHOPIFY_SUFFIX}` };
}

export function buildGraphqlEndpoint(
  myshopifyDomain: string,
  apiVersion: string,
): string {
  return `https://${myshopifyDomain}/admin/api/${apiVersion}/graphql.json`;
}
