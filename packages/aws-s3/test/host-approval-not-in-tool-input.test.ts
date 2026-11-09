import { describe, expect, it } from "vitest";

import {
  objectTextCreateInputSchema,
  objectTextReplaceInputSchema,
} from "../src/tool-schemas.js";

describe("host approval not in tool input", () => {
  it("create schema excludes host flags", () => {
    const keys = Object.keys(objectTextCreateInputSchema.shape);
    expect(keys).not.toContain("hostWritesApproved");
    expect(keys).not.toContain("createEnabled");
  });

  it("replace schema excludes host flags", () => {
    const keys = Object.keys(objectTextReplaceInputSchema.shape);
    expect(keys).not.toContain("hostWritesApproved");
    expect(keys).not.toContain("replaceEnabled");
  });
});
