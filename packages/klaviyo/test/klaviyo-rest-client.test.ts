import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import { KLAVIYO_API_REVISION } from "../src/constants.js";
import {
  startMockKlaviyoHttpServer,
  MOCK_CAMPAIGN_ID,
  MOCK_METRIC_ID,
  type MockKlaviyoHttpServer,
} from "./fixtures/mock-klaviyo-http-server.js";
import { createTestKlaviyoClient } from "./helpers/test-env.js";

describe("klaviyo-rest-client", () => {
  let server: MockKlaviyoHttpServer | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it("sends revision header and Klaviyo-API-Key authorization", async () => {
    server = await startMockKlaviyoHttpServer();
    const client = createTestKlaviyoClient(server);
    await client.getAccounts({});
    expect(server.getLastAuthorization()).toMatch(/^Klaviyo-API-Key /);
    expect(server.getLastRevision()).toBe(KLAVIYO_API_REVISION);
  });

  it("retries once on rate limit with Retry-After", async () => {
    server = await startMockKlaviyoHttpServer({ mode: "rate_limit_once" });
    const client = createTestKlaviyoClient(server);
    await client.getAccounts({});
    expect(server.getRequestCount()).toBe(2);
  });

  it("rejects oversize responses", async () => {
    server = await startMockKlaviyoHttpServer();
    const huge = "x".repeat(3_000_000);
    const fetchImpl: typeof fetch = async () =>
      new Response(huge, {
        status: 200,
        headers: { "Content-Type": "application/vnd.api+json" },
      });
    const client = createTestKlaviyoClient(server, fetchImpl);
    await expect(client.getAccounts({})).rejects.toBeInstanceOf(
      ConnectorSdkError,
    );
  });

  it("posts campaign values report with conversion metric id", async () => {
    server = await startMockKlaviyoHttpServer();
    const client = createTestKlaviyoClient(server);
    const raw = await client.queryCampaignValuesReport({
      statistics: ["opens"],
      timeframe: { key: "last_30_days" },
      conversionMetricId: MOCK_METRIC_ID,
    });
    expect(raw).toBeTruthy();
    await client.getCampaign({ id: MOCK_CAMPAIGN_ID });
  });
});
