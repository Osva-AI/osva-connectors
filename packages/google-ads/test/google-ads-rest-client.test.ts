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

  it("does not send deprecated pageSize on Search", async () => {
    server = await startMockGoogleAdsHttpServer();
    const client = createGoogleAdsRestClient({
      tokenProvider: createStaticBearerTokenProvider(
        FAKE_GOOGLE_ADS_ACCESS_TOKEN,
      ),
      requestTimeoutMs: 5_000,
      apiHost: server.apiOrigin,
    });
    await client.search({
      customerId: "1234567890",
      query: "SELECT campaign.id FROM campaign",
      pageSize: 50,
      signal: undefined,
    });
    const body = server.getLastSearchRequestBody();
    expect(body).toBeDefined();
    expect(body).not.toHaveProperty("pageSize");
    expect(body?.query).toContain("campaign");
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
