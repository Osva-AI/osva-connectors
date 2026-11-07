import { describe, expect, it } from "vitest";

import { vectorUpsertInputSchema } from "../src/tool-schemas.js";

describe("write gates are not in tool input", () => {
  it("vector upsert schema has no host approval fields", () => {
    expect(vectorUpsertInputSchema.shape).not.toHaveProperty("writeEnabled");
    expect(vectorUpsertInputSchema.shape).not.toHaveProperty(
      "hostWritesApproved",
    );
  });
});
