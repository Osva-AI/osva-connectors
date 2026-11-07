import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import {
  assertStructuredOutputWithinBudget,
  OUTPUT_MAX_STRUCTURED_JSON_BYTES,
  structuredOutputByteLength,
} from "../src/output-budget.js";
import { mapEventListResponse } from "../src/normalize-amplitude.js";

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

  it("truncates event lists to stay within budget", () => {
    const events = Array.from({ length: 400 }, (_, index) => ({
      name: `event_${index}`,
      display: "y".repeat(2_000),
    }));
    const result = mapEventListResponse({
      data: { events },
    }) as { events: unknown[]; eventsTruncated?: boolean };
    expect(result.events.length).toBeLessThan(events.length);
    expect(result.eventsTruncated).toBe(true);
    expect(structuredOutputByteLength(result)).toBeLessThanOrEqual(
      OUTPUT_MAX_STRUCTURED_JSON_BYTES,
    );
  });
});
