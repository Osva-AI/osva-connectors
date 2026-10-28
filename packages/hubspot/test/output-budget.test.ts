import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { mapCrmObjectListResponse } from "../src/normalize-resources.js";
import {
  assertStructuredOutputWithinBudget,
  OUTPUT_MAX_STRUCTURED_JSON_BYTES,
  structuredOutputByteLength,
} from "../src/output-budget.js";

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
      id: String(index),
      properties: { dealname: "x".repeat(900) },
    }));
    const result = mapCrmObjectListResponse("deals", rows, false, {}) as {
      dealsTruncated?: boolean;
      deals: unknown[];
    };
    expect(result.deals.length).toBeLessThan(rows.length);
    expect(result.dealsTruncated).toBe(true);
    expect(structuredOutputByteLength(result)).toBeLessThanOrEqual(
      OUTPUT_MAX_STRUCTURED_JSON_BYTES,
    );
  });
});
