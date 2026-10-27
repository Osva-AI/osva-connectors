import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { mapKlaviyoError } from "../src/map-klaviyo-error.js";
import type { KlaviyoHttpError } from "../src/klaviyo-rest-client.js";
import { FAKE_KLAVIYO_PRIVATE_API_KEY } from "./fixtures/mock-klaviyo-http-server.js";

describe("mapKlaviyoError", () => {
  it("redacts private API key from provider messages", () => {
    const error: KlaviyoHttpError = {
      kind: "http",
      status: 401,
      klaviyoCode: "authentication_failed",
      klaviyoDetail: `Invalid Klaviyo-API-Key ${FAKE_KLAVIYO_PRIVATE_API_KEY}`,
    };
    const mapped = mapKlaviyoError(error, {
      privateApiKey: FAKE_KLAVIYO_PRIVATE_API_KEY,
    });
    expect(mapped.code).toBe("UNAUTHORIZED");
    expect(JSON.stringify(mapped)).not.toContain(FAKE_KLAVIYO_PRIVATE_API_KEY);
  });

  it("maps permission failures to FORBIDDEN", () => {
    const mapped = mapKlaviyoError({
      kind: "http",
      status: 403,
      klaviyoCode: "permission_denied",
      klaviyoTitle: "Missing scope",
    });
    expect(mapped.code).toBe("FORBIDDEN");
  });

  it("maps rate limits", () => {
    const mapped = mapKlaviyoError({
      kind: "http",
      status: 429,
      klaviyoCode: "throttled",
    });
    expect(mapped.code).toBe("RATE_LIMITED");
  });

  it("passes through connector errors", () => {
    const original = new ConnectorSdkError("INVALID_INPUT", "bad");
    expect(mapKlaviyoError(original)).toBe(original);
  });
});
