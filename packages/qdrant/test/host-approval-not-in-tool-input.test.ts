import { describe, expect, it } from "vitest";

import { pointUpsertInputSchema } from "../src/tool-schemas.js";

describe("write gates are not in tool input", () => {
  it("point upsert schema has no host approval fields", () => {
    expect(pointUpsertInputSchema.shape).not.toHaveProperty("writeEnabled");
    expect(pointUpsertInputSchema.shape).not.toHaveProperty(
      "hostWritesApproved",
    );
  });
});
