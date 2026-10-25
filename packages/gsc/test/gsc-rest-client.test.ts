import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import { createStaticBearerTokenProvider } from "../src/gsc-auth.js";
import { createGscRestClient } from "../src/gsc-rest-client.js";
import { WEBMASTERS_API_HOST } from "../src/constants.js";
import {
  FAKE_GSC_ACCESS_TOKEN,
  MOCK_SITE_URL,
  startMockGscHttpServer,
  type MockGscHttpServer,
} from "./fixtures/mock-gsc-http-server.js";

describe("GSC REST client", () => {
  let server: MockGscHttpServer | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  function clientFor() {
    if (server === undefined) {
      throw new Error("server not started");
    }
    return createGscRestClient({
      tokenProvider: createStaticBearerTokenProvider(FAKE_GSC_ACCESS_TOKEN),
      requestTimeoutMs: 5_000,
      webmastersApiHost: server.webmastersApiOrigin,
      searchConsoleApiHost: server.searchConsoleApiOrigin,
    });
  }

  it("lists sites with authorization header", async () => {
    server = await startMockGscHttpServer();
    const client = clientFor();
    const raw = await client.listSites({});
    expect(raw).toMatchObject({ siteEntry: expect.any(Array) });
    expect(server.getLastAuthorization()).toBe(
      `Bearer ${FAKE_GSC_ACCESS_TOKEN}`,
    );
  });

  it("encodes domain properties in site get path", async () => {
    server = await startMockGscHttpServer();
    const client = clientFor();
    const raw = await client.getSite({ siteUrl: "sc-domain:example.com" });
    expect(raw).toMatchObject({ siteUrl: "sc-domain:example.com" });
  });

  it("posts search analytics query body", async () => {
    server = await startMockGscHttpServer();
    const client = clientFor();
    await client.searchAnalyticsQuery({
      siteUrl: MOCK_SITE_URL,
      startDate: "2024-01-01",
      endDate: "2024-01-07",
      dimensions: ["query"],
      rowLimit: 25,
      startRow: 0,
    });
    expect(server.getLastSearchAnalyticsBody()).toMatchObject({
      startDate: "2024-01-01",
      rowLimit: 25,
    });
  });

  it("rejects disallowed production host override via client guard", async () => {
    server = await startMockGscHttpServer();
    const client = createGscRestClient({
      tokenProvider: createStaticBearerTokenProvider(FAKE_GSC_ACCESS_TOKEN),
      requestTimeoutMs: 5_000,
      webmastersApiHost: "https://evil.example/webmasters/v3",
      searchConsoleApiHost: server.searchConsoleApiOrigin,
    });
    await expect(client.listSites({})).rejects.toBeInstanceOf(
      ConnectorSdkError,
    );
    expect(WEBMASTERS_API_HOST).toContain("googleapis.com");
  });

  it("retries once on 429 when within deadline", async () => {
    server = await startMockGscHttpServer({ mode: "rate_limit_once" });
    const client = clientFor();
    const raw = await client.listSites({});
    expect(raw).toMatchObject({ siteEntry: expect.any(Array) });
    expect(server.getRequestCount()).toBeGreaterThanOrEqual(2);
  });

  it("rejects oversized responses", async () => {
    server = await startMockGscHttpServer({ mode: "oversized" });
    const client = clientFor();
    await expect(client.listSites({})).rejects.toBeInstanceOf(
      ConnectorSdkError,
    );
  });

  it("supports cancellation", async () => {
    server = await startMockGscHttpServer({
      mode: "slow",
      slowDelayMs: 10_000,
    });
    const client = clientFor();
    const controller = new AbortController();
    const pending = client.listSites({ signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
});
