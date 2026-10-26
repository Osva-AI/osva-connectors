import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import {
  assertStructuredOutputWithinBudget,
  OUTPUT_MAX_STRUCTURED_JSON_BYTES,
  structuredOutputByteLength,
} from "../src/output-budget.js";

describe("output budget", () => {
  it("measures structured JSON byte length", () => {
    expect(structuredOutputByteLength({ a: "b" })).toBeGreaterThan(0);
    expect(OUTPUT_MAX_STRUCTURED_JSON_BYTES).toBe(262_144);
  });

  it("throws when payload exceeds budget", () => {
    const huge = { data: "x".repeat(300_000) };
    expect(() => assertStructuredOutputWithinBudget(huge)).toThrow(
      ConnectorSdkError,
    );
  });
});
