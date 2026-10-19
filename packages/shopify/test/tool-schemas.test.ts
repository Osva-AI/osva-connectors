import { describe, expect, it } from "vitest";

import { inventoryLevelsListInputSchema } from "../src/tool-schemas.js";

describe("tool input schemas", () => {
  it("requires locationId or inventoryItemId for inventory levels", () => {
    expect(inventoryLevelsListInputSchema.safeParse({}).success).toBe(false);
    expect(
      inventoryLevelsListInputSchema.safeParse({
        locationId: "gid://shopify/Location/1",
      }).success,
    ).toBe(true);
    expect(
      inventoryLevelsListInputSchema.safeParse({
        inventoryItemId: "gid://shopify/InventoryItem/1",
      }).success,
    ).toBe(true);
  });

  it("rejects excessively long cursors", () => {
    expect(
      inventoryLevelsListInputSchema.safeParse({
        locationId: "gid://shopify/Location/1",
        cursor: "x".repeat(600),
      }).success,
    ).toBe(false);
  });
});
