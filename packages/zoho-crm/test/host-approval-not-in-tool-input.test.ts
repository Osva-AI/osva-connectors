import { describe, expect, it } from "vitest";

import {
  dealNoteAddInputSchema,
  dealStageSetInputSchema,
} from "../src/tool-schemas.js";

describe("Zoho CRM: host approval is not a tool input field", () => {
  it("mutation schemas do not expose write gates", () => {
    for (const schema of [dealNoteAddInputSchema, dealStageSetInputSchema]) {
      expect(schema.shape).not.toHaveProperty("notesEnabled");
      expect(schema.shape).not.toHaveProperty("hostWritesApproved");
      expect(schema.shape).not.toHaveProperty("statusEnabled");
    }
  });
});
