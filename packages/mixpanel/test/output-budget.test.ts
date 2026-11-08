import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import {
  assertStructuredOutputWithinBudget,
  OUTPUT_MAX_STRUCTURED_JSON_BYTES,
  structuredOutputByteLength,
} from "../src/output-budget.js";

describe("output budget", () => {
  it("accepts payloads within budget", () => {
    const payload = { data: { ok: true } };
    expect(structuredOutputByteLength(payload)).toBeLessThanOrEqual(
      OUTPUT_MAX_STRUCTURED_JSON_BYTES,
    );
    expect(() => assertStructuredOutputWithinBudget(payload)).not.toThrow();
  });

  it("rejects oversized payloads", () => {
    const huge = { data: "x".repeat(OUTPUT_MAX_STRUCTURED_JSON_BYTES) };
    expect(() => assertStructuredOutputWithinBudget(huge)).toThrow(
      ConnectorSdkError,
    );
  });
});
