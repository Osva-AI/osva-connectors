import { describe, expect, it } from "vitest";

import { mapLinearError } from "../src/map-linear-error.js";

describe("mapLinearError", () => {
  it("maps unauthorized http errors", () => {
    const error = mapLinearError({ kind: "http", status: 401 });
    expect(error.code).toBe("UNAUTHORIZED");
  });

  it("maps rate limit http errors", () => {
    const error = mapLinearError({ kind: "http", status: 429 });
    expect(error.code).toBe("RATE_LIMITED");
  });

  it("maps graphql authentication errors", () => {
    const error = mapLinearError({
      kind: "graphql",
      messages: ["Authentication required"],
      extensionCodes: ["AUTHENTICATION_ERROR"],
    });
    expect(error.code).toBe("UNAUTHORIZED");
  });

  it("redacts credentials from error messages", () => {
    const credential = "lin_api_abc123fixture";
    const error = mapLinearError(new Error(`Failed with ${credential}`), {
      credential,
    });
    expect(error.message).not.toContain(credential);
  });
});
