import { describe, expect, it } from "vitest";

import {
  mapPerformanceQueriesResponse,
  mapSearchAnalyticsResponse,
  SEARCH_ANALYTICS_REPORTING_NOTES,
} from "../src/normalize-analytics.js";

describe("normalize-analytics", () => {
  it("maps rows and reporting notes", () => {
    const result = mapSearchAnalyticsResponse({
      siteUrl: "https://example.com/",
      startDate: "2024-01-01",
      endDate: "2024-01-07",
      dimensions: ["query"],
      rowLimit: 100,
      startRow: 0,
      raw: {
        rows: [
          {
            keys: ["test query"],
            clicks: 1,
            impressions: 10,
            ctr: 0.1,
            position: 2.5,
          },
        ],
        responseAggregationType: "byProperty",
      },
    });
    expect(result.rows[0]?.clicks).toBe(1);
    expect(result.reportingNotes).toEqual(SEARCH_ANALYTICS_REPORTING_NOTES);
    expect(result.rowsReturned).toBe(1);
  });

  it("maps query preset rows", () => {
    const result = mapPerformanceQueriesResponse({
      siteUrl: "https://example.com/",
      startDate: "2024-01-01",
      endDate: "2024-01-07",
      rowLimit: 10,
      startRow: 0,
      raw: {
        rows: [
          {
            keys: ["hello"],
            clicks: 2,
            impressions: 20,
            ctr: 0.1,
            position: 3,
          },
        ],
      },
    });
    expect(result.rows[0]).toMatchObject({ query: "hello", ctr: 0.1 });
  });
});
