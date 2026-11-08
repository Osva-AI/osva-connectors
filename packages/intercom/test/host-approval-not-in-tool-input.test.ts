import { describe, expect, it } from "vitest";

import {
  conversationNoteAddInputSchema,
  conversationStateSetInputSchema,
} from "../src/tool-schemas.js";

describe("Intercom: host approval is not a tool input field", () => {
  it("mutation schemas do not expose write gates", () => {
    for (const schema of [
      conversationNoteAddInputSchema,
      conversationStateSetInputSchema,
    ]) {
      expect(schema.shape).not.toHaveProperty("notesEnabled");
      expect(schema.shape).not.toHaveProperty("hostWritesApproved");
    }
  });
});
