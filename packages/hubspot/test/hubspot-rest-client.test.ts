import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import {
  MOCK_CONTACT_ID,
  startMockHubspotHttpServer,
  type MockHubspotHttpServer,
} from "./fixtures/mock-hubspot-http-server.js";
import { createTestHubspotClient } from "./helpers/test-env.js";

describe("hubspot-rest-client", () => {
  let server: MockHubspotHttpServer | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it("sends Bearer authorization", async () => {
    server = await startMockHubspotHttpServer();
    const client = createTestHubspotClient(server);
    await client.listCrmObjects("contacts", {
      pageSize: 10,
      properties: ["lifecyclestage"],
    });
    expect(server.getLastAuthorization()).toMatch(/^Bearer /);
  });

  it("retries once on rate limit with Retry-After", async () => {
    server = await startMockHubspotHttpServer({ mode: "rate_limit_once" });
    const client = createTestHubspotClient(server);
    await client.listCrmObjects("contacts", {
      pageSize: 10,
      properties: ["lifecyclestage"],
    });
    expect(server.getRequestCount()).toBe(2);
  });

  it("rejects oversize responses", async () => {
    server = await startMockHubspotHttpServer();
    const huge = "x".repeat(3_000_000);
    const fetchImpl: typeof fetch = async () =>
      new Response(huge, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    const client = createTestHubspotClient(server, fetchImpl);
    await expect(
      client.listCrmObjects("contacts", {
        pageSize: 10,
        properties: ["lifecyclestage"],
      }),
    ).rejects.toBeInstanceOf(ConnectorSdkError);
  });

  it("fetches a CRM object by id", async () => {
    server = await startMockHubspotHttpServer();
    const client = createTestHubspotClient(server);
    const raw = await client.getCrmObject("contacts", {
      id: MOCK_CONTACT_ID,
      properties: ["lifecyclestage"],
    });
    expect(raw).toBeTruthy();
  });
});
