import { describe, expect, it } from "vitest";

import { normalizeAccountIdInput } from "../src/account-id.js";

describe("normalizeAccountIdInput", () => {
  it("accepts numeric and act_ prefixed IDs", () => {
    expect(normalizeAccountIdInput("1234567890")).toBe("act_1234567890");
    expect(normalizeAccountIdInput("act_1234567890")).toBe("act_1234567890");
  });

  it("rejects URLs and path-like values", () => {
    expect(() =>
      normalizeAccountIdInput("https://graph.facebook.com/act_1"),
    ).toThrow();
    expect(() => normalizeAccountIdInput("act/123")).toThrow();
  });
});
