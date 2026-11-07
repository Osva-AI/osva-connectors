import { describe, expect, it } from "vitest";

import { mapNotionError } from "../src/map-notion-error.js";

describe("mapNotionError", () => {
  it("maps unauthorized http errors", () => {
    const error = mapNotionError({
      kind: "http",
      status: 401,
      notionCode: "unauthorized",
    });
    expect(error.code).toBe("UNAUTHORIZED");
  });

  it("redacts tokens from error messages", () => {
    const token = "secret_abc123fixture";
    const error = mapNotionError(new Error(`Failed with ${token}`), {
      accessToken: token,
    });
    expect(error.message).not.toContain(token);
  });
});
