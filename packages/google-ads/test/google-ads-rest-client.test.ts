import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import { createGoogleAdsRestClient } from "../src/google-ads-rest-client.js";
import { createStaticBearerTokenProvider } from "../src/google-ads-auth.js";
import {
  FAKE_GOOGLE_ADS_ACCESS_TOKEN,
  startMockGoogleAdsHttpServer,
  type MockGoogleAdsHttpServer,
} from "./fixtures/mock-google-ads-http-server.js";

describe("Google Ads REST client", () => {
  let server: MockGoogleAdsHttpServer | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it("rejects oversized responses", async () => {
    server = await startMockGoogleAdsHttpServer({ mode: "oversized" });
    const client = createGoogleAdsRestClient({
      tokenProvider: createStaticBearerTokenProvider(
        FAKE_GOOGLE_ADS_ACCESS_TOKEN,
      ),
      requestTimeoutMs: 5_000,
      apiHost: server.apiOrigin,
    });
    await expect(client.listAccessibleCustomers({})).rejects.toBeInstanceOf(
      ConnectorSdkError,
    );
  });

  it("times out slow responses", async () => {
    server = await startMockGoogleAdsHttpServer({
      mode: "slow",
      slowDelayMs: 3_000,
    });
    const client = createGoogleAdsRestClient({
      tokenProvider: createStaticBearerTokenProvider(
        FAKE_GOOGLE_ADS_ACCESS_TOKEN,
      ),
      requestTimeoutMs: 200,
      apiHost: server.apiOrigin,
    });
    await expect(client.listAccessibleCustomers({})).rejects.toThrow(
      /timed out/i,
    );
  });
});
