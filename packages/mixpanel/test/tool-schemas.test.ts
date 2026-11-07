import { describe, expect, it } from "vitest";

import {
  eventTopInputSchema,
  funnelGetInputSchema,
  retentionRunInputSchema,
  segmentationRunInputSchema,
} from "../src/tool-schemas.js";

describe("tool schemas", () => {
  it("rejects lookback longer than 90 days", () => {
    const result = segmentationRunInputSchema.safeParse({
      event: "Sign Up",
      fromDate: "2024-01-01",
      toDate: "2024-05-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects event names with newlines", () => {
    const result = retentionRunInputSchema.safeParse({
      bornEvent: "Sign\nUp",
      event: "Purchase",
      fromDate: "2024-01-01",
      toDate: "2024-01-07",
    });
    expect(result.success).toBe(false);
  });

  it("rejects where expressions with newlines", () => {
    const result = segmentationRunInputSchema.safeParse({
      event: "Sign Up",
      fromDate: "2024-01-01",
      toDate: "2024-01-07",
      where: 'properties["foo"]\nand 1',
    });
    expect(result.success).toBe(false);
  });

  it("caps event.top limit", () => {
    const result = eventTopInputSchema.safeParse({ limit: 9999 });
    expect(result.success).toBe(false);
  });

  it("requires funnel query date range per Query API", () => {
    const missing = funnelGetInputSchema.safeParse({ funnelId: "10" });
    expect(missing.success).toBe(false);
    const ok = funnelGetInputSchema.safeParse({
      funnelId: "10",
      fromDate: "2024-01-01",
      toDate: "2024-01-07",
    });
    expect(ok.success).toBe(true);
  });
});
