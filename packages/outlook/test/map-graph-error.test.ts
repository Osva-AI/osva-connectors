import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { mapGraphError } from "../src/map-graph-error.js";

describe("mapGraphError", () => {
  it("maps http 401 to UNAUTHORIZED", () => {
    const err = mapGraphError({
      kind: "http",
      status: 401,
    });
    expect(err).toBeInstanceOf(ConnectorSdkError);
    expect(err.code).toBe("UNAUTHORIZED");
  });

  it("maps http 429 when ambiguousMutation uses non-retryable RATE_LIMITED", () => {
    const err = mapGraphError(
      { kind: "http", status: 429 },
      { ambiguousMutation: true },
    );
    expect(err.code).toBe("RATE_LIMITED");
    expect(err.retryable).toBe(false);
  });

  it("redacts bearer tokens in error messages", () => {
    const secret = "supersecretdelegatedtoken";
    const err = mapGraphError(new Error(`failed Bearer ${secret} boom`), {
      accessToken: secret,
    });
    expect(err.message).not.toContain(secret);
  });
});
