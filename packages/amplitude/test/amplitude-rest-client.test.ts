import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  startMockAmplitudeHttpServer,
  MOCK_CHART_ID,
  type MockAmplitudeHttpServer,
} from "./fixtures/mock-amplitude-http-server.js";
import { createTestAmplitudeClient } from "./helpers/test-env.js";

describe("amplitude-rest-client", () => {
  let server: MockAmplitudeHttpServer | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it("sends HTTP Basic authorization", async () => {
    server = await startMockAmplitudeHttpServer();
    const client = createTestAmplitudeClient(server);
    await client.listEventTypes({});
    expect(server.getLastAuthorization()).toMatch(/^Basic /);
  });

  it("retries once on rate limit with Retry-After", async () => {
    server = await startMockAmplitudeHttpServer({ mode: "rate_limit_once" });
    const client = createTestAmplitudeClient(server);
    await client.listEventTypes({});
    expect(server.getRequestCount()).toBe(2);
  });

  it("encodes funnel event JSON in query parameters", async () => {
    server = await startMockAmplitudeHttpServer();
    const client = createTestAmplitudeClient(server);
    await client.queryFunnel({
      start: "20240601",
      end: "20240607",
      events: [{ event_type: "View Product" }, { event_type: "Purchase" }],
    });
    const encoded = server.getLastQueryEvents();
    expect(encoded.length).toBe(2);
    expect(JSON.parse(encoded[0] ?? "{}")).toEqual({
      event_type: "View Product",
    });
  });

  it("queries chart by id", async () => {
    server = await startMockAmplitudeHttpServer();
    const client = createTestAmplitudeClient(server);
    await client.queryChart({ chartId: MOCK_CHART_ID });
    expect(server.getLastRequestPath()).toContain(MOCK_CHART_ID);
  });

  it("rejects oversize responses", async () => {
    server = await startMockAmplitudeHttpServer();
    const huge = "x".repeat(3_000_000);
    const fetchImpl: typeof fetch = async () =>
      new Response(huge, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    const client = createTestAmplitudeClient(server, fetchImpl);
    await expect(client.listEventTypes({})).rejects.toBeInstanceOf(
      ConnectorSdkError,
    );
  });
});
