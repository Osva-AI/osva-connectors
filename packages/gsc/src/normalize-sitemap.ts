import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { SITEMAP_MAX_ENTRIES } from "./constants.js";
import {
  assertStructuredOutputWithinBudget,
  normalizeEssentialProviderString,
  normalizeTruncatableProviderString,
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  packListWithinOutputBudget,
} from "./output-budget.js";

const UNEXPECTED =
  "Google Search Console returned an unexpected sitemap payload.";

export interface NormalizedSitemapEntry {
  readonly path: string;
  readonly lastSubmitted?: string;
  readonly isPending?: boolean;
  readonly isSitemapsIndex?: boolean;
  readonly type?: string;
  readonly lastDownloaded?: string;
  readonly warnings?: string;
  readonly errors?: string;
  readonly contents?: Array<{
    readonly type?: string;
    readonly submitted?: string;
    readonly indexed?: string;
  }>;
}

export interface NormalizedSitemapList {
  readonly siteUrl: string;
  readonly sitemaps: NormalizedSitemapEntry[];
  readonly sitemapsTruncated?: true;
}

export interface NormalizedSitemapGet extends NormalizedSitemapEntry {
  readonly siteUrl: string;
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  return normalizeTruncatableProviderString(
    value,
    OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  ).value;
}

function mapSitemapEntry(raw: unknown): NormalizedSitemapEntry {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError("PROVIDER_ERROR", UNEXPECTED);
  }
  const record = raw as Record<string, unknown>;
  const path = normalizeEssentialProviderString(
    record.path,
    OUTPUT_MAX_PROVIDER_STRING_LENGTH,
    UNEXPECTED,
  );

  const contentsRaw = record.contents;
  let contents: NormalizedSitemapEntry["contents"];
  if (Array.isArray(contentsRaw)) {
    contents = [];
    for (const item of contentsRaw.slice(0, 50)) {
      if (item === null || typeof item !== "object") {
        continue;
      }
      const c = item as Record<string, unknown>;
      contents.push({
        ...(optionalString(c.type) !== undefined
          ? { type: optionalString(c.type) }
          : {}),
        ...(optionalString(c.submitted) !== undefined
          ? { submitted: optionalString(c.submitted) }
          : {}),
        ...(optionalString(c.indexed) !== undefined
          ? { indexed: optionalString(c.indexed) }
          : {}),
      });
    }
  }

  return {
    path,
    ...(optionalString(record.lastSubmitted) !== undefined
      ? { lastSubmitted: optionalString(record.lastSubmitted) }
      : {}),
    ...(typeof record.isPending === "boolean"
      ? { isPending: record.isPending }
      : {}),
    ...(typeof record.isSitemapsIndex === "boolean"
      ? { isSitemapsIndex: record.isSitemapsIndex }
      : {}),
    ...(optionalString(record.type) !== undefined
      ? { type: optionalString(record.type) }
      : {}),
    ...(optionalString(record.lastDownloaded) !== undefined
      ? { lastDownloaded: optionalString(record.lastDownloaded) }
      : {}),
    ...(optionalString(record.warnings) !== undefined
      ? { warnings: optionalString(record.warnings) }
      : {}),
    ...(optionalString(record.errors) !== undefined
      ? { errors: optionalString(record.errors) }
      : {}),
    ...(contents !== undefined && contents.length > 0 ? { contents } : {}),
  };
}

export function mapSitemapListResponse(
  siteUrl: string,
  raw: unknown,
): NormalizedSitemapList {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError("PROVIDER_ERROR", UNEXPECTED);
  }
  const sitemap = (raw as { sitemap?: unknown }).sitemap;
  const entries = Array.isArray(sitemap) ? sitemap : [];
  const mapped = entries
    .slice(0, SITEMAP_MAX_ENTRIES)
    .map((entry) => mapSitemapEntry(entry));

  const packed = packListWithinOutputBudget(
    { siteUrl, sitemaps: [] as NormalizedSitemapEntry[] },
    "sitemaps",
    mapped,
  );
  assertStructuredOutputWithinBudget(packed);
  return packed;
}

export function mapSitemapGetResponse(
  siteUrl: string,
  raw: unknown,
): NormalizedSitemapGet {
  const entry = mapSitemapEntry(raw);
  const result: NormalizedSitemapGet = { siteUrl, ...entry };
  assertStructuredOutputWithinBudget(result);
  return result;
}
