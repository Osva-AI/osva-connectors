import { describe, expect, it } from "vitest";

import {
  answerInputSchema,
  contentsGetInputSchema,
  searchInputSchema,
} from "../src/tool-schemas.js";

describe("Exa: credentials are not tool input fields", () => {
  it("tool schemas do not expose secret or host gate fields", () => {
    for (const schema of [
      searchInputSchema,
      contentsGetInputSchema,
      answerInputSchema,
    ]) {
      expect(schema.shape).not.toHaveProperty("apiKey");
      expect(schema.shape).not.toHaveProperty("xApiKey");
      expect(schema.shape).not.toHaveProperty("writeEnabled");
      expect(schema.shape).not.toHaveProperty("hostWritesApproved");
      expect(schema.shape).not.toHaveProperty("hostMutationsApproved");
    }
  });
});
