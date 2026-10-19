import { describe, expect, it } from "vitest";

import {
  reportRunInputSchema,
  reportRealtimeInputSchema,
} from "../src/tool-schemas.js";

describe("tool input schemas", () => {
  it("requires at least one metric for custom reports", () => {
    const parsed = reportRunInputSchema.safeParse({
      startDate: "2024-01-01",
      endDate: "2024-01-31",
      metrics: [],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects invalid dimension names", () => {
    const parsed = reportRunInputSchema.safeParse({
      startDate: "today",
      endDate: "today",
      metrics: ["activeUsers"],
      dimensions: ["bad name"],
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts relative GA4 dates", () => {
    const parsed = reportRunInputSchema.safeParse({
      startDate: "7daysAgo",
      endDate: "today",
      metrics: ["sessions"],
    });
    expect(parsed.success).toBe(true);
  });

  it("allows realtime without metrics", () => {
    const parsed = reportRealtimeInputSchema.safeParse({});
    expect(parsed.success).toBe(true);
  });
});
