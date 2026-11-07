import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { mapMixpanelError } from "../src/map-mixpanel-error.js";
import {
  FAKE_MIXPANEL_SECRET,
  FAKE_MIXPANEL_USERNAME,
} from "./fixtures/mock-mixpanel-http-server.js";

describe("mapMixpanelError", () => {
  it("maps http 401 to UNAUTHORIZED", () => {
    const mapped = mapMixpanelError({ kind: "http", status: 401 });
    expect(mapped.code).toBe("UNAUTHORIZED");
  });

  it("maps http 429 to rate limit", () => {
    const mapped = mapMixpanelError({ kind: "http", status: 429 });
    expect(mapped.code).toBe("RATE_LIMITED");
  });

  it("redacts basic auth credentials from error messages", () => {
    const token = Buffer.from(
      `${FAKE_MIXPANEL_USERNAME}:${FAKE_MIXPANEL_SECRET}`,
      "utf8",
    ).toString("base64");
    const mapped = mapMixpanelError(
      new Error(`Authorization: Basic ${token} failed`),
      {
        serviceAccountUsername: FAKE_MIXPANEL_USERNAME,
        serviceAccountSecret: FAKE_MIXPANEL_SECRET,
      },
    );
    expect(mapped.message).not.toContain(FAKE_MIXPANEL_SECRET);
    expect(mapped.message).not.toContain(token);
    expect(JSON.stringify(mapped)).not.toContain(FAKE_MIXPANEL_SECRET);
  });

  it("maps abort to cancelled", () => {
    const mapped = mapMixpanelError(new DOMException("Aborted", "AbortError"));
    expect(mapped.code).toBe("CANCELLED");
  });

  it("passes through ConnectorSdkError", () => {
    const original = new ConnectorSdkError("INVALID_INPUT", "bad");
    expect(mapMixpanelError(original)).toBe(original);
  });
});
