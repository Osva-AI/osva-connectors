import { describe, expect, it } from "vitest";

import {
  ticketNoteAddInputSchema,
  ticketStatusSetInputSchema,
} from "../src/tool-schemas.js";

describe("Freshdesk: host approval is not a tool input field", () => {
  it("mutation schemas do not expose write gates", () => {
    for (const schema of [
      ticketNoteAddInputSchema,
      ticketStatusSetInputSchema,
    ]) {
      expect(schema.shape).not.toHaveProperty("notesEnabled");
      expect(schema.shape).not.toHaveProperty("hostWritesApproved");
    }
  });
});
