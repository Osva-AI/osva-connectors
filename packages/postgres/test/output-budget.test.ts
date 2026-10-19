import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import {
  assertStructuredOutputWithinBudget,
  OUTPUT_MAX_STRUCTURED_JSON_BYTES,
  structuredOutputByteLength,
} from "../src/output-budget.js";

describe("postgres output budget", () => {
  it("measures structured JSON byte length", () => {
    expect(structuredOutputByteLength({ ok: true })).toBeGreaterThan(0);
  });

  it("rejects payloads above 256 KiB", () => {
    const huge = { data: "x".repeat(OUTPUT_MAX_STRUCTURED_JSON_BYTES) };
    expect(() => assertStructuredOutputWithinBudget(huge)).toThrow(
      ConnectorSdkError,
    );
  });
});
