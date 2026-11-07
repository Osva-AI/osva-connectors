import { describe, expect, it } from "vitest";

import {
  pageCreateInputSchema,
  pageUpdateInputSchema,
} from "../src/tool-schemas.js";

describe("Confluence: host approval is not a tool input field", () => {
  it("mutation schemas do not expose write gates", () => {
    for (const schema of [pageCreateInputSchema, pageUpdateInputSchema]) {
      expect(schema.shape).not.toHaveProperty("writeEnabled");
      expect(schema.shape).not.toHaveProperty("hostWritesApproved");
    }
  });
});
