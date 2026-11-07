import { describe, expect, it } from "vitest";

import { mapTavilyError } from "../src/map-tavily-error.js";

describe("mapTavilyError", () => {
  it("maps unauthorized http errors", () => {
    const error = mapTavilyError({
      kind: "http",
      status: 401,
      detail: { error: "Unauthorized" },
    });
    expect(error.code).toBe("UNAUTHORIZED");
  });

  it("maps payment required (402)", () => {
    const error = mapTavilyError({
      kind: "http",
      status: 402,
      detail: { error: "Payment required" },
    });
    expect(error.code).toBe("FORBIDDEN");
    expect(error.message).toContain("credits");
  });

  it("maps plan limit responses", () => {
    const error = mapTavilyError({
      kind: "http",
      status: 432,
      detail: { error: "Plan limit exceeded" },
    });
    expect(error.code).toBe("FORBIDDEN");
  });

  it("redacts API keys from error messages", () => {
    const key = "tvly_fixture_secret_key";
    const error = mapTavilyError(new Error(`Failed with ${key}`), {
      apiKey: key,
    });
    expect(error.message).not.toContain(key);
  });
});
