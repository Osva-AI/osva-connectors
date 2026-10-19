import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { mapRunReportResponse } from "../src/normalize-report.js";

describe("mapRunReportResponse", () => {
  it("accepts valid empty reports with metric headers", () => {
    const mapped = mapRunReportResponse({
      propertyId: "123456789",
      limit: 100,
      offset: 0,
      raw: {
        dimensionHeaders: [{ name: "country" }],
        metricHeaders: [{ name: "activeUsers" }],
        rows: [],
        rowCount: 0,
      },
    });
    expect(mapped.rows).toEqual([]);
    expect(mapped.rowCount).toBe(0);
    expect(mapped.hasMoreRows).toBeUndefined();
  });

  it("sets hasMoreRows when provider rowCount exceeds this page", () => {
    const mapped = mapRunReportResponse({
      propertyId: "123456789",
      limit: 10,
      offset: 0,
      raw: {
        dimensionHeaders: [],
        metricHeaders: [{ name: "sessions" }],
        rows: [{ dimensionValues: [], metricValues: [{ value: "1" }] }],
        rowCount: 50,
      },
    });
    expect(mapped.hasMoreRows).toBe(true);
    expect(mapped.rowCount).toBe(50);
    expect(mapped.rowsReturned).toBe(1);
  });

  it("rejects misaligned row values", () => {
    expect(() =>
      mapRunReportResponse({
        propertyId: "123456789",
        limit: 10,
        offset: 0,
        raw: {
          dimensionHeaders: [{ name: "country" }],
          metricHeaders: [{ name: "activeUsers" }],
          rows: [
            {
              dimensionValues: [],
              metricValues: [{ value: "1" }],
            },
          ],
          rowCount: 1,
        },
      }),
    ).toThrow(ConnectorSdkError);
  });
});
