import { describe, expect, it } from "vitest";

import {
  commentCreateInputSchema,
  issueCreateInputSchema,
  issueUpdateInputSchema,
} from "../src/tool-schemas.js";

describe("Linear: host approval is not a tool input field", () => {
  it("mutation schemas do not expose write gates", () => {
    for (const schema of [
      issueCreateInputSchema,
      issueUpdateInputSchema,
      commentCreateInputSchema,
    ]) {
      expect(schema.shape).not.toHaveProperty("writeEnabled");
      expect(schema.shape).not.toHaveProperty("hostMutationsApproved");
    }
  });
});
