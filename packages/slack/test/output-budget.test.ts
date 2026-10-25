import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import {
  OUTPUT_MAX_STRUCTURED_JSON_BYTES,
  assertStructuredOutputWithinBudget,
  packListWithinOutputBudget,
  structuredOutputByteLength,
} from "../src/output-budget.js";

describe("output budget", () => {
  it("measures structured JSON byte length", () => {
    expect(structuredOutputByteLength({ a: "b" })).toBeGreaterThan(0);
  });

  it("throws when structured output exceeds cap", () => {
    const huge = "x".repeat(OUTPUT_MAX_STRUCTURED_JSON_BYTES);
    expect(() => assertStructuredOutputWithinBudget({ text: huge })).toThrow(
      ConnectorSdkError,
    );
  });

  it("packs lists with truncation metadata", () => {
    const items = Array.from({ length: 200 }, (_, i) => ({
      id: String(i),
      text: "y".repeat(8000),
    }));
    const packed = packListWithinOutputBudget({}, "messages", items);
    expect(packed.messages.length).toBeLessThan(items.length);
    expect(packed.messagesTruncated).toBe(true);
  });
});
