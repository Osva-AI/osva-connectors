import { describe, expect, it } from "vitest";

import {
  issueCommentCreateInputSchema,
  issueCreateInputSchema,
  issueTransitionInputSchema,
  issueUpdateInputSchema,
} from "../src/tool-schemas.js";

describe("Jira: host approval is not a tool input field", () => {
  it("mutation schemas do not expose write gates", () => {
    for (const schema of [
      issueCreateInputSchema,
      issueUpdateInputSchema,
      issueCommentCreateInputSchema,
      issueTransitionInputSchema,
    ]) {
      expect(schema.shape).not.toHaveProperty("writeEnabled");
      expect(schema.shape).not.toHaveProperty("hostWritesApproved");
    }
  });
});
