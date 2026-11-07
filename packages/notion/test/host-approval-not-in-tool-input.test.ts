import { describe, expect, it } from "vitest";

import {
  blockChildrenAppendInputSchema,
  pageCreateInputSchema,
  pageUpdateInputSchema,
} from "../src/tool-schemas.js";

describe("Notion: host approval is not a tool input field", () => {
  it("mutation schemas do not expose write gates", () => {
    for (const schema of [
      pageCreateInputSchema,
      pageUpdateInputSchema,
      blockChildrenAppendInputSchema,
    ]) {
      expect(schema.shape).not.toHaveProperty("writeEnabled");
      expect(schema.shape).not.toHaveProperty("hostWritesApproved");
    }
    expect(pageUpdateInputSchema.shape).not.toHaveProperty("archived");
    expect(pageUpdateInputSchema.shape).toHaveProperty("inTrash");
    expect(blockChildrenAppendInputSchema.shape).not.toHaveProperty("after");
  });
});
