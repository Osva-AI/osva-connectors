import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import { createStaticBearerTokenProvider } from "../src/ga4-auth.js";
import { createGa4RestClient } from "../src/ga4-rest-client.js";
import {
  FAKE_GA4_ACCESS_TOKEN,
  MOCK_PROPERTY_ID,
  startMockGa4HttpServer,
  type MockGa4HttpServer,
} from "./fixtures/mock-ga4-http-server.js";

describe("GA4 REST client", () => {
  let server: MockGa4HttpServer | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  function clientFor() {
    if (server === undefined) {
      throw new Error("server not started");
    }
    return createGa4RestClient({
      tokenProvider: createStaticBearerTokenProvider(FAKE_GA4_ACCESS_TOKEN),
      requestTimeoutMs: 5_000,
      dataApiHost: server.dataApiOrigin,
      adminApiHost: server.adminApiOrigin,
    });
  }

  it("sends Authorization header and parses property list", async () => {
    server = await startMockGa4HttpServer();
    const client = clientFor();
    const raw = await client.listAccountSummaries({ pageSize: 50 });
    expect(raw).toMatchObject({ accountSummaries: expect.any(Array) });
    expect(server.getLastAuthorization()).toBe(
      `Bearer ${FAKE_GA4_ACCESS_TOKEN}`,
    );
  });

  it("maps missing token to unauthorized from mock", async () => {
    server = await startMockGa4HttpServer();
    const client = createGa4RestClient({
      tokenProvider: createStaticBearerTokenProvider("wrong-token"),
      requestTimeoutMs: 5_000,
      dataApiHost: server.dataApiOrigin,
      adminApiHost: server.adminApiOrigin,
    });
    await expect(
      client.getProperty({ propertyId: MOCK_PROPERTY_ID }),
    ).rejects.toMatchObject({ kind: "http", status: 401 });
  });

  it("retries once on 429 when within deadline", async () => {
    server = await startMockGa4HttpServer({ mode: "rate_limit_once" });
    const client = clientFor();
    const raw = await client.getMetadata({ propertyId: MOCK_PROPERTY_ID });
    expect(raw).toMatchObject({ dimensions: expect.any(Array) });
    expect(server.getRequestCount()).toBeGreaterThanOrEqual(2);
  });

  it("rejects oversized responses", async () => {
    server = await startMockGa4HttpServer({ mode: "oversized" });
    const client = clientFor();
    await expect(
      client.getMetadata({ propertyId: MOCK_PROPERTY_ID }),
    ).rejects.toBeInstanceOf(ConnectorSdkError);
  });

  it("supports cancellation", async () => {
    server = await startMockGa4HttpServer({
      mode: "slow",
      slowDelayMs: 10_000,
    });
    const client = clientFor();
    const controller = new AbortController();
    const pending = client.getMetadata({
      propertyId: MOCK_PROPERTY_ID,
      signal: controller.signal,
    });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });

  it("times out slow responses", async () => {
    server = await startMockGa4HttpServer({
      mode: "slow",
      slowDelayMs: 10_000,
    });
    const client = createGa4RestClient({
      tokenProvider: createStaticBearerTokenProvider(FAKE_GA4_ACCESS_TOKEN),
      requestTimeoutMs: 100,
      dataApiHost: server.dataApiOrigin,
      adminApiHost: server.adminApiOrigin,
    });
    await expect(
      client.getMetadata({ propertyId: MOCK_PROPERTY_ID }),
    ).rejects.toSatisfy(
      (error: unknown) =>
        (error instanceof Error && error.message.includes("timed out")) ||
        (error instanceof DOMException && error.name === "AbortError"),
    );
  });
});
