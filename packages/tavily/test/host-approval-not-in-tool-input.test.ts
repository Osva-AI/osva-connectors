import { describe, expect, it } from "vitest";

import {
  crawlInputSchema,
  extractInputSchema,
  searchInputSchema,
} from "../src/tool-schemas.js";

describe("Tavily: credentials are not tool input fields", () => {
  it("schemas do not expose API keys or host gates", () => {
    for (const schema of [
      searchInputSchema,
      extractInputSchema,
      crawlInputSchema,
    ]) {
      expect(schema.shape).not.toHaveProperty("apiKey");
      expect(schema.shape).not.toHaveProperty("accessToken");
      expect(schema.shape).not.toHaveProperty("writeEnabled");
    }
  });
});
