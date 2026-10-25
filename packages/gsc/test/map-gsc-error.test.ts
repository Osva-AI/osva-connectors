import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { mapGscError } from "../src/map-gsc-error.js";

describe("mapGscError", () => {
  it("redacts bearer tokens in messages", () => {
    const token = "ya29.secret-token-value";
    const error = mapGscError(new Error(`Failure Bearer ${token}`), {
      accessToken: token,
    });
    expect(error.message).not.toContain(token);
  });

  it("maps http 403 to forbidden", () => {
    const error = mapGscError({
      kind: "http",
      status: 403,
      googleStatus: "PERMISSION_DENIED",
      googleMessage: "Permission denied",
    });
    expect(error.code).toBe("FORBIDDEN");
  });

  it("maps abort to cancelled", () => {
    const error = mapGscError(new DOMException("Aborted", "AbortError"));
    expect(error.code).toBe("CANCELLED");
  });

  it("maps timeout strings", () => {
    const error = mapGscError(
      new Error("Google Search Console request timed out."),
    );
    expect(error.code).toBe("TIMEOUT");
    expect(error.retryable).toBe(true);
  });

  it("passes through connector errors", () => {
    const original = new ConnectorSdkError("INVALID_INPUT", "bad");
    expect(mapGscError(original)).toBe(original);
  });
});
