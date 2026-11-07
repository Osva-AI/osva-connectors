import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { mapConfluenceError } from "../src/map-confluence-error.js";

describe("mapConfluenceError", () => {
  it("maps 409 to conflict", () => {
    const mapped = mapConfluenceError({
      kind: "http",
      status: 409,
      message: "Version conflict",
    });
    expect(mapped).toBeInstanceOf(ConnectorSdkError);
    expect(mapped.code).toBe("CONFLICT");
  });

  it("redacts bearer tokens from messages", () => {
    const token = "super_secret_token_value";
    const mapped = mapConfluenceError(new Error(`Failed Bearer ${token}`), {
      credential: token,
    });
    expect(mapped.message).not.toContain(token);
  });
});
