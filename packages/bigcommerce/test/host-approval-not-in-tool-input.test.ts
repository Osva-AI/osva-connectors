import { describe, expect, it } from "vitest";

import {
  orderStatusUpdateInputSchema,
  productUpdateInputSchema,
} from "../src/tool-schemas.js";

describe("BigCommerce: host approval is not a tool input field", () => {
  it("mutation schemas do not expose write gates", () => {
    for (const schema of [
      productUpdateInputSchema,
      orderStatusUpdateInputSchema,
    ]) {
      expect(schema.shape).not.toHaveProperty("writeEnabled");
      expect(schema.shape).not.toHaveProperty("hostWritesApproved");
    }
  });
});
