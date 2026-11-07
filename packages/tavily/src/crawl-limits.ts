import {
  CRAWL_MAX_BREADTH,
  CRAWL_MAX_DEPTH,
  CRAWL_MAX_LIMIT,
} from "./constants.js";

export interface CrawlLimitsRequest {
  readonly maxDepth?: number;
  readonly limit?: number;
  readonly maxBreadth?: number;
}

export interface CrawlLimitsApplied {
  readonly maxDepth: number;
  readonly limit: number;
  readonly maxBreadth: number;
}

export interface ResolvedCrawlLimits {
  readonly applied: CrawlLimitsApplied;
  readonly requested: CrawlLimitsApplied;
  readonly clamped: boolean;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function resolveCrawlLimits(
  input: CrawlLimitsRequest,
  defaults: CrawlLimitsApplied,
): ResolvedCrawlLimits {
  const requested: CrawlLimitsApplied = {
    maxDepth: input.maxDepth ?? defaults.maxDepth,
    limit: input.limit ?? defaults.limit,
    maxBreadth: input.maxBreadth ?? defaults.maxBreadth,
  };

  const applied: CrawlLimitsApplied = {
    maxDepth: clampInt(requested.maxDepth, 1, CRAWL_MAX_DEPTH),
    limit: clampInt(requested.limit, 1, CRAWL_MAX_LIMIT),
    maxBreadth: clampInt(requested.maxBreadth, 1, CRAWL_MAX_BREADTH),
  };

  const clamped =
    applied.maxDepth !== requested.maxDepth ||
    applied.limit !== requested.limit ||
    applied.maxBreadth !== requested.maxBreadth;

  return { applied, requested, clamped };
}
