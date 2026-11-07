import { describe, expect, it } from "vitest";

import { mapExaError } from "../src/map-exa-error.js";

describe("mapExaError", () => {
  it("maps unauthorized http errors", () => {
    const error = mapExaError({
      kind: "http",
      status: 401,
      exaTag: "UNAUTHORIZED",
    });
    expect(error.code).toBe("UNAUTHORIZED");
  });

  it("maps rate limit errors", () => {
    const error = mapExaError({
      kind: "http",
      status: 429,
      exaMessage: "Rate limited",
    });
    expect(error.code).toBe("RATE_LIMITED");
  });

  it("redacts API keys from error messages", () => {
    const apiKey = "exa_secret_fixture_key_123456789";
    const error = mapExaError(new Error(`Failed with ${apiKey}`), { apiKey });
    expect(error.message).not.toContain(apiKey);
    expect(error.message).toContain("[REDACTED]");
  });

  it("marks ambiguous cost operation timeouts as non-retryable", () => {
    const error = mapExaError(new Error("Exa request timed out."), {
      ambiguousCostOp: true,
    });
    expect(error.code).toBe("TIMEOUT");
    expect(error.retryable).toBe(false);
  });
});
