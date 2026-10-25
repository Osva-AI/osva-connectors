import { describe, expect, it } from "vitest";

import {
  performanceQueryInputSchema,
  urlInspectInputSchema,
} from "../src/tool-schemas.js";

describe("tool-schemas", () => {
  it("rejects invalid analytics dates", () => {
    const result = performanceQueryInputSchema.safeParse({
      startDate: "2024-13-40",
      endDate: "2024-01-02",
    });
    expect(result.success).toBe(false);
  });

  it("accepts bounded analytics query", () => {
    const result = performanceQueryInputSchema.safeParse({
      startDate: "2024-01-01",
      endDate: "2024-01-07",
      dimensions: ["query", "page"],
      rowLimit: 50,
    });
    expect(result.success).toBe(true);
  });

  it("requires http(s) inspection URL", () => {
    expect(
      urlInspectInputSchema.safeParse({
        inspectionUrl: "https://example.com/page",
      }).success,
    ).toBe(true);
    expect(
      urlInspectInputSchema.safeParse({
        inspectionUrl: "javascript:alert(1)",
      }).success,
    ).toBe(false);
  });
});
