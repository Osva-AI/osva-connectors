import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import {
  assertStructuredOutputWithinBudget,
  OUTPUT_MAX_STRUCTURED_JSON_BYTES,
  structuredOutputByteLength,
} from "../src/output-budget.js";
import { mapResourceListResponse } from "../src/normalize-resources.js";

describe("output budget", () => {
  it("measures structured JSON byte length", () => {
    expect(structuredOutputByteLength({ a: 1 })).toBeGreaterThan(0);
  });

  it("throws when payload exceeds budget", () => {
    const huge = { data: "x".repeat(OUTPUT_MAX_STRUCTURED_JSON_BYTES) };
    expect(() => assertStructuredOutputWithinBudget(huge)).toThrow(
      ConnectorSdkError,
    );
  });

  it("truncates list rows to stay within budget", () => {
    const rows = Array.from({ length: 800 }, (_, index) => ({
      type: "metric",
      id: `id${String(index).padStart(4, "0")}`,
      attributes: { name: "x".repeat(900) },
    }));
    const result = mapResourceListResponse("metric", { data: rows }, {}) as {
      metricsTruncated?: boolean;
      metrics: unknown[];
    };
    expect(result.metrics.length).toBeLessThan(rows.length);
    expect(result.metricsTruncated).toBe(true);
    expect(structuredOutputByteLength(result)).toBeLessThanOrEqual(
      OUTPUT_MAX_STRUCTURED_JSON_BYTES,
    );
  });
});
