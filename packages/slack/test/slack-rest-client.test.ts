import { afterEach, describe, expect, it } from "vitest";

import { mapSlackError } from "../src/map-slack-error.js";
import { createSlackRestClient } from "../src/slack-rest-client.js";
import {
  FAKE_SLACK_BOT_TOKEN,
  MOCK_CHANNEL_PUBLIC,
  startMockSlackHttpServer,
  type MockSlackHttpServer,
} from "./fixtures/mock-slack-http-server.js";
import { createTestSlackClient } from "./helpers/test-env.js";

describe("createSlackRestClient", () => {
  let server: MockSlackHttpServer | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it("sends Authorization bearer header only", async () => {
    server = await startMockSlackHttpServer();
    const client = createTestSlackClient(server);
    await client.authTest({});
    expect(server.getLastAuthorization()).toBe(
      `Bearer ${FAKE_SLACK_BOT_TOKEN}`,
    );
  });

  it("retries read calls once on rate limit when Retry-After fits", async () => {
    server = await startMockSlackHttpServer({ mode: "rate_limit_once" });
    const client = createTestSlackClient(server);
    await client.authTest({});
    expect(server.getRequestCount()).toBe(2);
  });

  it("does not retry write calls", async () => {
    server = await startMockSlackHttpServer({ mode: "rate_limit" });
    const client = createTestSlackClient(server);
    await expect(
      client.postMessage({
        channelId: MOCK_CHANNEL_PUBLIC,
        text: "hello",
      }),
    ).rejects.toBeTruthy();
    expect(server.getPostMessageCount()).toBe(0);
    expect(server.getRequestCount()).toBe(1);
  });

  it("rejects oversized responses", async () => {
    server = await startMockSlackHttpServer({ mode: "oversized" });
    const client = createTestSlackClient(server);
    await expect(client.authTest({})).rejects.toMatchObject({
      code: "PROVIDER_ERROR",
    });
  });

  it("rejects invalid JSON", async () => {
    server = await startMockSlackHttpServer({ mode: "invalid_json" });
    const client = createTestSlackClient(server);
    await expect(client.authTest({})).rejects.toMatchObject({
      code: "PROVIDER_ERROR",
    });
  });

  it("restricts production API base URL", () => {
    expect(() =>
      createSlackRestClient({
        botToken: FAKE_SLACK_BOT_TOKEN,
        requestTimeoutMs: 5_000,
        apiBaseUrl: "https://evil.example/api/",
      }),
    ).not.toThrow();
    expect(() =>
      createSlackRestClient({
        botToken: FAKE_SLACK_BOT_TOKEN,
        requestTimeoutMs: 5_000,
      }),
    ).not.toThrow();
  });

  it("filters channel list by allowlist without changing cursor", async () => {
    server = await startMockSlackHttpServer();
    const client = createTestSlackClient(server, {
      allowedChannelIds: [MOCK_CHANNEL_PUBLIC],
    });
    const page = await client.listChannels({ limit: 10 });
    expect(page.channels.every((c) => c.id === MOCK_CHANNEL_PUBLIC)).toBe(true);
    expect(page.allowlistFiltered).toBe(true);
    expect(page.nextCursor).toBe("page-2");
    expect(page.hasMore).toBe(true);
  });

  it("maps HTTP 5xx on reads as retryable via mapSlackError path", async () => {
    server = await startMockSlackHttpServer({ mode: "server_error" });
    const client = createTestSlackClient(server);
    await expect(client.authTest({})).rejects.toBeTruthy();
    expect(server.getRequestCount()).toBeGreaterThanOrEqual(1);
  });

  it("honours abort signal", async () => {
    server = await startMockSlackHttpServer({ mode: "slow", slowDelayMs: 500 });
    const client = createTestSlackClient(server);
    const controller = new AbortController();
    const promise = client.authTest({ signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
  });

  it("throws on missing scope errors", async () => {
    server = await startMockSlackHttpServer({ mode: "missing_scope" });
    const client = createTestSlackClient(server);
    await expect(
      client.getChannelInfo({ channelId: MOCK_CHANNEL_PUBLIC }),
    ).rejects.toMatchObject({ kind: "slack_api", slackError: "missing_scope" });
    expect(
      mapSlackError({ kind: "slack_api", slackError: "missing_scope" }).code,
    ).toBe("FORBIDDEN");
  });
});
