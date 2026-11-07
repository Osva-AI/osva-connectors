import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  FAKE_MIXPANEL_SECRET,
  FAKE_MIXPANEL_USERNAME,
  startMockMixpanelHttpServer,
  type MockMixpanelHttpServer,
} from "./fixtures/mock-mixpanel-http-server.js";
import { createTestMixpanelClient } from "./helpers/test-env.js";

describe("mixpanel rest client", () => {
  let server: MockMixpanelHttpServer | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it("does not send unsupported limit on cohort list", async () => {
    server = await startMockMixpanelHttpServer();
    const client = createTestMixpanelClient(server);
    await client.listCohorts({});
    const lastUrl = server.getLastRequestUrl();
    expect(lastUrl).toBeDefined();
    expect(new URL(lastUrl!).searchParams.has("limit")).toBe(false);
  });

  it("calls insights with basic auth", async () => {
    server = await startMockMixpanelHttpServer();
    const client = createTestMixpanelClient(server);
    const result = await client.getInsights({ bookmarkId: "99" });
    expect(result).toMatchObject({ series: expect.any(Object) });
    expect(server.getLastAuthorization()).toContain("Basic ");
    expect(server.getRequestCount()).toBe(1);
  });

  it("retries once on 429", async () => {
    server = await startMockMixpanelHttpServer({ mode: "rate_limit_once" });
    const client = createTestMixpanelClient(server);
    await client.getTopEvents({ limit: 5 });
    expect(server.getRequestCount()).toBe(2);
  });

  it("maps unauthorized", async () => {
    server = await startMockMixpanelHttpServer({ mode: "unauthorized" });
    const client = createTestMixpanelClient(server);
    await expect(client.listCohorts({})).rejects.toMatchObject({
      kind: "http",
      status: 401,
    });
  });

  it("rejects oversized responses", async () => {
    server = await startMockMixpanelHttpServer({ mode: "oversized" });
    const client = createTestMixpanelClient(server);
    await expect(
      client.getInsights({ bookmarkId: "1" }),
    ).rejects.toBeInstanceOf(ConnectorSdkError);
  });

  it("does not leak credentials in thrown provider errors", async () => {
    server = await startMockMixpanelHttpServer({ mode: "forbidden" });
    const client = createTestMixpanelClient(server);
    try {
      await client.getFunnel({
        funnelId: "1",
        fromDate: "2024-01-01",
        toDate: "2024-01-07",
      });
      expect.fail("expected error");
    } catch (error) {
      const serialized = JSON.stringify(error);
      expect(serialized).not.toContain(FAKE_MIXPANEL_SECRET);
      expect(serialized).not.toContain(FAKE_MIXPANEL_USERNAME);
    }
  });
});
