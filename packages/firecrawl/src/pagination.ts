import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  FIRECRAWL_API_HOST,
  MAX_PAGINATION_NEXT_URL_LENGTH,
} from "./constants.js";

const PRODUCTION_HOSTNAME = "api.firecrawl.dev";

const CRAWL_PATH_PREFIXES = ["/crawl/", "/v2/crawl/", "/v1/crawl/"] as const;

function isSupportedCrawlPath(pathname: string): boolean {
  return CRAWL_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function crawlIdFromPath(pathname: string): string | undefined {
  for (const prefix of CRAWL_PATH_PREFIXES) {
    if (!pathname.startsWith(prefix)) {
      continue;
    }
    const remainder = pathname.slice(prefix.length);
    const id = remainder.split("/")[0]?.trim();
    if (id !== undefined && id.length > 0) {
      return id.toLowerCase();
    }
  }
  return undefined;
}

export function validateCrawlNextInput(nextUrl: string): string {
  const trimmed = nextUrl.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_PAGINATION_NEXT_URL_LENGTH) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Crawl pagination URL is not valid.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Crawl pagination URL is not valid.",
    );
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Crawl pagination URL is not valid.",
    );
  }

  if (!isSupportedCrawlPath(parsed.pathname)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Crawl pagination URL path is not supported.",
    );
  }

  return parsed.toString();
}

export function assertCrawlPaginationUrl(
  nextUrl: string,
  apiHost: string = FIRECRAWL_API_HOST,
  crawlId?: string,
): string {
  const trimmed = nextUrl.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_PAGINATION_NEXT_URL_LENGTH) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Crawl pagination URL is not valid.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Crawl pagination URL is not valid.",
    );
  }

  const normalizedApiHost = apiHost.replace(/\/$/, "");
  const onApi =
    trimmed === normalizedApiHost ||
    trimmed.startsWith(`${normalizedApiHost}/`);
  const isLocalTest =
    parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";

  if (apiHost === FIRECRAWL_API_HOST) {
    if (parsed.protocol !== "https:") {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Crawl pagination URL is not allowlisted.",
      );
    }
    if (parsed.hostname !== PRODUCTION_HOSTNAME) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Crawl pagination URL is not allowlisted.",
      );
    }
  } else if (isLocalTest && apiHost.startsWith("http://")) {
    // mock server
  } else if (!onApi) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Crawl pagination URL is not allowlisted.",
    );
  }

  if (!isSupportedCrawlPath(parsed.pathname)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Crawl pagination URL path is not supported.",
    );
  }
  if (crawlId !== undefined) {
    const linkedId = crawlIdFromPath(parsed.pathname);
    if (linkedId === undefined || linkedId !== crawlId.trim().toLowerCase()) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Crawl pagination URL does not match the requested crawl job.",
      );
    }
  }

  return parsed.toString();
}

export function assertCrawlStatusNextUrl(
  nextUrl: unknown,
  apiHost: string = FIRECRAWL_API_HOST,
  crawlId?: string,
): string | undefined {
  if (nextUrl === undefined) {
    return undefined;
  }
  if (typeof nextUrl !== "string") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Firecrawl returned an invalid pagination link.",
    );
  }
  if (nextUrl.trim().length === 0) {
    return undefined;
  }
  return assertCrawlPaginationUrl(nextUrl, apiHost, crawlId);
}
