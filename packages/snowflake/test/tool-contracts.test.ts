import { describe, expect, it } from "vitest";

import {
  rowsSampleInputSchema,
  tableAggregateInputSchema,
} from "../src/tool-schemas.js";

describe("tool contracts (snowflake)", () => {
  it("rejects extra properties on row sample input", () => {
    const parsed = rowsSampleInputSchema.safeParse({
      schema: "APP",
      table: "USERS",
      sql: "SELECT 1",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts bounded aggregate metrics", () => {
    const parsed = tableAggregateInputSchema.safeParse({
      schema: "APP",
      table: "USERS",
      metrics: [{ fn: "count" }],
      groupBy: ["EMAIL"],
    });
    expect(parsed.success).toBe(true);
  });
});
