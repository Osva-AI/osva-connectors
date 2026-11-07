import { describe, expect, it } from "vitest";

import { mapJiraError } from "../src/map-jira-error.js";

describe("mapJiraError", () => {
  it("maps unauthorized http errors", () => {
    const error = mapJiraError({
      kind: "http",
      status: 401,
    });
    expect(error.code).toBe("UNAUTHORIZED");
  });

  it("redacts credentials from error messages", () => {
    const token = "secret_fixture_token";
    const error = mapJiraError(new Error(`Failed with ${token}`), {
      credential: token,
    });
    expect(error.message).not.toContain(token);
  });
});
