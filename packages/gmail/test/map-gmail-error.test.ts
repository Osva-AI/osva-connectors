import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { mapGmailError } from "../src/map-gmail-error.js";

describe("mapGmailError", () => {
  it("maps http 401 to UNAUTHORIZED", () => {
    const err = mapGmailError({
      kind: "http",
      status: 401,
    });
    expect(err).toBeInstanceOf(ConnectorSdkError);
    expect(err.code).toBe("UNAUTHORIZED");
  });

  it("maps http 429 when ambiguousMutation uses non-retryable RATE_LIMITED", () => {
    const err = mapGmailError(
      { kind: "http", status: 429 },
      { ambiguousMutation: true },
    );
    expect(err.code).toBe("RATE_LIMITED");
    expect(err.retryable).toBe(false);
  });

  it("maps http 429 read path to RATE_LIMITED", () => {
    const err = mapGmailError({ kind: "http", status: 429 });
    expect(err.code).toBe("RATE_LIMITED");
  });
});
