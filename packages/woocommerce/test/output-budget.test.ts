import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import {
  assertStructuredOutputWithinBudget,
  OUTPUT_MAX_STRUCTURED_JSON_BYTES,
  packListWithinOutputBudget,
  structuredOutputByteLength,
} from "../src/output-budget.js";

describe("WooCommerce output budget", () => {
  it("accepts payloads within budget", () => {
    const payload = { products: [{ id: 1, name: "A" }] };
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

  it("packListWithinOutputBudget trims when necessary", () => {
    const items = Array.from({ length: 5_000 }, (_, i) => ({
      id: i,
      name: "x".repeat(200),
    }));
    const packed = packListWithinOutputBudget(
      { pageInfo: { page: 1 } },
      "products",
      items,
    );
    expect(packed.products.length).toBeLessThan(items.length);
    expect(packed.truncated).toBe(true);
  });
});
