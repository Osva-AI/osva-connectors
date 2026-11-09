import { describe, expect, it } from "vitest";

import {
  aggregateInputSchema,
  datasetGetInputSchema,
  rowsSampleInputSchema,
  tableGetInputSchema,
} from "../src/tool-schemas.js";

describe("tool input schemas", () => {
  it("rejects unknown aggregate properties", () => {
    const parsed = aggregateInputSchema.safeParse({
      datasetId: "analytics",
      tableId: "events",
      metrics: [{ fn: "count" }],
      rawSql: "SELECT 1",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts bounded row sample input", () => {
    const parsed = rowsSampleInputSchema.safeParse({
      datasetId: "analytics",
      tableId: "events",
      limit: 10,
      filter: { op: "eq", column: "event_name", value: "signup" },
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects empty dataset id", () => {
    expect(datasetGetInputSchema.safeParse({ datasetId: "" }).success).toBe(
      false,
    );
    expect(
      tableGetInputSchema.safeParse({ datasetId: "analytics", tableId: "" })
        .success,
    ).toBe(false);
  });
});
