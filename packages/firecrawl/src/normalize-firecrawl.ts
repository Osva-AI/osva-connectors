import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  MAX_CRAWL_ITEM_MARKDOWN_CODEPOINTS,
  MAX_CRAWL_STATUS_DATA_ITEMS,
  MAX_SCRAPE_MARKDOWN_CODEPOINTS,
} from "./constants.js";
import {
  normalizeEssentialProviderString,
  normalizeTruncatableProviderString,
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  packListWithinOutputBudget,
} from "./output-budget.js";
import { assertCrawlStatusNextUrl } from "./pagination.js";
import { parseHttpUrl } from "./http-url.js";

function assertSuccessPayload(raw: unknown): Record<string, unknown> {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Firecrawl returned an unexpected payload.",
    );
  }
  const record = raw as Record<string, unknown>;
  if (record.success === false) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Firecrawl reported an unsuccessful response.",
    );
  }
  return record;
}

function readOptionalSourceUrl(data: unknown): string | undefined {
  if (data === null || typeof data !== "object") {
    return undefined;
  }
  const metadata = (data as { metadata?: unknown }).metadata;
  if (metadata === null || typeof metadata !== "object") {
    return undefined;
  }
  const sourceUrl = (metadata as { sourceURL?: unknown; url?: unknown })
    .sourceURL;
  if (typeof sourceUrl === "string" && sourceUrl.length > 0) {
    try {
      return parseHttpUrl(sourceUrl, "source URL");
    } catch {
      return undefined;
    }
  }
  const url = (metadata as { url?: unknown }).url;
  if (typeof url === "string" && url.length > 0) {
    try {
      return parseHttpUrl(url, "source URL");
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function mapScrapeResponse(
  raw: unknown,
  requestedUrl: string,
): Record<string, unknown> {
  const record = assertSuccessPayload(raw);
  const data = record.data;
  const envelope: Record<string, unknown> = {
    url: requestedUrl,
  };
  const resolvedUrl = readOptionalSourceUrl(data);
  if (resolvedUrl !== undefined && resolvedUrl !== requestedUrl) {
    envelope.resolvedUrl = resolvedUrl;
  }

  if (data !== null && typeof data === "object") {
    const markdown = (data as { markdown?: unknown }).markdown;
    if (markdown !== undefined) {
      const normalized = normalizeTruncatableProviderString(
        markdown,
        MAX_SCRAPE_MARKDOWN_CODEPOINTS,
      );
      envelope.markdown = normalized.value;
      if (normalized.truncated) {
        envelope.markdownTruncated = true;
      }
    }
  }

  if (typeof record.creditsUsed === "number") {
    envelope.creditsUsed = record.creditsUsed;
  }

  return envelope;
}

export interface NormalizedSearchResult {
  url: string;
  title?: string;
  description?: string;
  markdown?: string;
  markdownTruncated?: true;
}

function normalizeSearchResultItem(item: unknown): NormalizedSearchResult {
  if (item === null || typeof item !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Firecrawl returned an unexpected search result.",
    );
  }
  const record = item as Record<string, unknown>;
  const urlValue = record.url;
  if (typeof urlValue !== "string") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Firecrawl search result is missing a URL.",
    );
  }
  const url = parseHttpUrl(urlValue, "search result URL");
  const normalized: NormalizedSearchResult = { url };

  if (typeof record.title === "string" && record.title.length > 0) {
    normalized.title = normalizeEssentialProviderString(
      record.title,
      OUTPUT_MAX_PROVIDER_STRING_LENGTH,
    );
  }
  if (typeof record.description === "string" && record.description.length > 0) {
    normalized.description = normalizeEssentialProviderString(
      record.description,
      OUTPUT_MAX_PROVIDER_STRING_LENGTH,
    );
  }

  const markdown = record.markdown;
  if (markdown !== undefined) {
    const truncated = normalizeTruncatableProviderString(
      markdown,
      MAX_CRAWL_ITEM_MARKDOWN_CODEPOINTS,
    );
    normalized.markdown = truncated.value;
    if (truncated.truncated) {
      normalized.markdownTruncated = true;
    }
  }

  return normalized;
}

export function mapSearchResponse(raw: unknown): Record<string, unknown> {
  const record = assertSuccessPayload(raw);
  const data = record.data;
  const results: NormalizedSearchResult[] = [];

  if (data !== null && typeof data === "object") {
    const web = (data as { web?: unknown }).web;
    if (Array.isArray(web)) {
      for (const item of web) {
        results.push(normalizeSearchResultItem(item));
      }
    }
  }

  const envelope: Record<string, unknown> = {};
  if (typeof record.creditsUsed === "number") {
    envelope.creditsUsed = record.creditsUsed;
  }

  const packed = packListWithinOutputBudget(envelope, "results", results);
  return packed;
}

export interface NormalizedMapLink {
  url: string;
  title?: string;
  description?: string;
}

function normalizeMapLink(item: unknown): NormalizedMapLink {
  if (typeof item === "string") {
    return { url: parseHttpUrl(item, "map link URL") };
  }
  if (item === null || typeof item !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Firecrawl returned an unexpected map link.",
    );
  }
  const record = item as Record<string, unknown>;
  if (typeof record.url !== "string" || record.url.length === 0) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Firecrawl map link is missing a URL.",
    );
  }
  const url = parseHttpUrl(record.url, "map link URL");
  const normalized: NormalizedMapLink = { url };
  if (typeof record.title === "string" && record.title.length > 0) {
    normalized.title = normalizeEssentialProviderString(
      record.title,
      OUTPUT_MAX_PROVIDER_STRING_LENGTH,
    );
  }
  if (typeof record.description === "string" && record.description.length > 0) {
    normalized.description = normalizeEssentialProviderString(
      record.description,
      OUTPUT_MAX_PROVIDER_STRING_LENGTH,
    );
  }
  return normalized;
}

export function mapMapResponse(raw: unknown): Record<string, unknown> {
  const record = assertSuccessPayload(raw);
  const linksRaw = record.links;
  const links: NormalizedMapLink[] = [];
  if (Array.isArray(linksRaw)) {
    for (const item of linksRaw) {
      links.push(normalizeMapLink(item));
    }
  }
  return packListWithinOutputBudget({}, "links", links);
}

export function mapCrawlStartResponse(raw: unknown): {
  readonly crawlId: string;
} {
  const record = assertSuccessPayload(raw);
  const id = record.id;
  if (typeof id !== "string" || id.trim().length === 0) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Firecrawl crawl start response is missing a job ID.",
    );
  }
  return { crawlId: id.trim().toLowerCase() };
}

export interface NormalizedCrawlPage {
  url?: string;
  markdown?: string;
  markdownTruncated?: true;
}

function normalizeCrawlDataItem(item: unknown): NormalizedCrawlPage {
  if (item === null || typeof item !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Firecrawl returned an unexpected crawl page.",
    );
  }
  const record = item as Record<string, unknown>;
  const normalized: NormalizedCrawlPage = {};
  const metadata = record.metadata;
  if (metadata !== null && typeof metadata === "object") {
    const sourceUrl = (metadata as { sourceURL?: unknown; url?: unknown })
      .sourceURL;
    if (typeof sourceUrl === "string") {
      try {
        normalized.url = parseHttpUrl(sourceUrl, "crawl page URL");
      } catch {
        // omit invalid provider URL
      }
    }
  }

  const markdown = record.markdown;
  if (markdown !== undefined) {
    const truncated = normalizeTruncatableProviderString(
      markdown,
      MAX_CRAWL_ITEM_MARKDOWN_CODEPOINTS,
    );
    normalized.markdown = truncated.value;
    if (truncated.truncated) {
      normalized.markdownTruncated = true;
    }
  }

  return normalized;
}

export interface MapCrawlStatusOptions {
  readonly apiHost?: string;
  readonly crawlId?: string;
}

export function mapCrawlStatusResponse(
  raw: unknown,
  options?: MapCrawlStatusOptions,
): Record<string, unknown> {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Firecrawl returned an unexpected crawl status payload.",
    );
  }
  const record = raw as Record<string, unknown>;
  const status = record.status;
  if (typeof status !== "string" || status.length === 0) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Firecrawl crawl status is missing a status value.",
    );
  }

  const envelope: Record<string, unknown> = {
    status,
  };

  if (typeof record.completed === "number") {
    envelope.completed = record.completed;
  }
  if (typeof record.total === "number") {
    envelope.total = record.total;
  }
  if (typeof record.creditsUsed === "number") {
    envelope.creditsUsed = record.creditsUsed;
  }

  const next = assertCrawlStatusNextUrl(
    record.next,
    options?.apiHost,
    options?.crawlId,
  );
  if (next !== undefined) {
    envelope.next = next;
  }

  const dataRaw = record.data;
  const items: NormalizedCrawlPage[] = [];
  if (Array.isArray(dataRaw)) {
    const capped = dataRaw.slice(0, MAX_CRAWL_STATUS_DATA_ITEMS);
    for (const item of capped) {
      items.push(normalizeCrawlDataItem(item));
    }
    if (dataRaw.length > MAX_CRAWL_STATUS_DATA_ITEMS) {
      envelope.dataTruncated = true;
    }
  }

  return packListWithinOutputBudget(envelope, "data", items);
}
