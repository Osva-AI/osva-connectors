import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { createStaticBearerTokenProvider } from "../src/ga4-auth.js";
import { FAKE_GA4_ACCESS_TOKEN } from "./fixtures/mock-ga4-http-server.js";

describe("GA4 auth providers", () => {
  it("returns bearer header for static token provider", async () => {
    const provider = createStaticBearerTokenProvider(FAKE_GA4_ACCESS_TOKEN);
    await expect(provider.getAuthorizationHeader()).resolves.toBe(
      `Bearer ${FAKE_GA4_ACCESS_TOKEN}`,
    );
  });

  it("fails closed for empty static token", async () => {
    const provider = createStaticBearerTokenProvider("   ");
    await expect(provider.getAuthorizationHeader()).rejects.toBeInstanceOf(
      ConnectorSdkError,
    );
  });
});
