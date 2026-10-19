import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { mapGa4Error } from "../src/map-ga4-error.js";
import { FAKE_GA4_ACCESS_TOKEN } from "./fixtures/mock-ga4-http-server.js";

describe("mapGa4Error", () => {
  it("maps http 401 to UNAUTHORIZED", () => {
    const mapped = mapGa4Error({
      kind: "http",
      status: 401,
    });
    expect(mapped.code).toBe("UNAUTHORIZED");
  });

  it("maps http 429 to rate limit", () => {
    const mapped = mapGa4Error({ kind: "http", status: 429 });
    expect(mapped.code).toBe("RATE_LIMITED");
  });

  it("redacts bearer tokens from error messages", () => {
    const mapped = mapGa4Error(
      new Error(`Bearer ${FAKE_GA4_ACCESS_TOKEN} failed`),
      { accessToken: FAKE_GA4_ACCESS_TOKEN },
    );
    expect(mapped.message).not.toContain(FAKE_GA4_ACCESS_TOKEN);
    expect(JSON.stringify(mapped)).not.toContain(FAKE_GA4_ACCESS_TOKEN);
  });

  it("maps abort to cancelled", () => {
    const mapped = mapGa4Error(new DOMException("Aborted", "AbortError"));
    expect(mapped.code).toBe("CANCELLED");
  });

  it("passes through ConnectorSdkError", () => {
    const original = new ConnectorSdkError("INVALID_INPUT", "bad");
    expect(mapGa4Error(original)).toBe(original);
  });
});
