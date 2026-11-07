import { describe, expect, it } from "vitest";

import { resolveCrawlLimits } from "../src/crawl-limits.js";
import {
  CRAWL_DEFAULT_LIMIT,
  CRAWL_DEFAULT_MAX_BREADTH,
  CRAWL_DEFAULT_MAX_DEPTH,
  CRAWL_MAX_BREADTH,
  CRAWL_MAX_DEPTH,
  CRAWL_MAX_LIMIT,
} from "../src/constants.js";

describe("resolveCrawlLimits", () => {
  const defaults = {
    maxDepth: CRAWL_DEFAULT_MAX_DEPTH,
    limit: CRAWL_DEFAULT_LIMIT,
    maxBreadth: CRAWL_DEFAULT_MAX_BREADTH,
  };

  it("clamps values above connector maximums", () => {
    const resolved = resolveCrawlLimits(
      { maxDepth: 99, limit: 100, maxBreadth: 500 },
      defaults,
    );
    expect(resolved.applied).toEqual({
      maxDepth: CRAWL_MAX_DEPTH,
      limit: CRAWL_MAX_LIMIT,
      maxBreadth: CRAWL_MAX_BREADTH,
    });
    expect(resolved.clamped).toBe(true);
  });

  it("passes through values within bounds", () => {
    const resolved = resolveCrawlLimits(
      { maxDepth: 2, limit: 5, maxBreadth: 8 },
      defaults,
    );
    expect(resolved.applied.maxDepth).toBe(2);
    expect(resolved.clamped).toBe(false);
  });
});
