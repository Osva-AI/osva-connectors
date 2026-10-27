import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { mapMetaError } from "../src/map-meta-error.js";
import type { MetaGraphHttpError } from "../src/meta-graph-client.js";
import { FAKE_META_ADS_ACCESS_TOKEN } from "./fixtures/mock-meta-ads-http-server.js";

describe("mapMetaError", () => {
  it("maps expired token without leaking secret", () => {
    const error: MetaGraphHttpError = {
      kind: "http",
      status: 400,
      metaCode: 190,
      metaMessage: `Token ${FAKE_META_ADS_ACCESS_TOKEN} expired`,
    };
    const mapped = mapMetaError(error, {
      accessToken: FAKE_META_ADS_ACCESS_TOKEN,
    });
    expect(mapped.code).toBe("UNAUTHORIZED");
    expect(mapped.message).not.toContain(FAKE_META_ADS_ACCESS_TOKEN);
  });

  it("maps rate limits", () => {
    const mapped = mapMetaError({
      kind: "http",
      status: 429,
      metaCode: 17,
    });
    expect(mapped.code).toBe("RATE_LIMITED");
  });

  it("passes through connector errors", () => {
    const original = new ConnectorSdkError("INVALID_INPUT", "bad");
    expect(mapMetaError(original)).toBe(original);
  });
});
