import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { FIRECRAWL_API_HOST } from "../src/constants.js";
import {
  assertCrawlPaginationUrl,
  validateCrawlNextInput,
} from "../src/pagination.js";

describe("Firecrawl crawl pagination", () => {
  const crawlId = "abc123";

  it("accepts v2 crawl continuation URLs", () => {
    const next = `https://api.firecrawl.dev/v2/crawl/${crawlId}?skip=1`;
    expect(validateCrawlNextInput(next)).toBe(next);
    expect(assertCrawlPaginationUrl(next, FIRECRAWL_API_HOST, crawlId)).toBe(
      next,
    );
  });

  it("rejects continuation for a different crawl id", () => {
    const next = `https://api.firecrawl.dev/v2/crawl/other-id?skip=1`;
    expect(() =>
      assertCrawlPaginationUrl(next, FIRECRAWL_API_HOST, crawlId),
    ).toThrow(ConnectorSdkError);
  });
});
