import { afterEach, describe, expect, it } from "vitest";

import { createZohoRestClient } from "../src/zoho-rest-client.js";
import {
  FAKE_ZOHO_ACCESS_TOKEN,
  FIXTURE_DEAL_ID,
  startMockZohoHttpServer,
  type MockZohoHttpServer,
} from "./fixtures/mock-zoho-http-server.js";

describe("Zoho CRM rest client", () => {
  let server: MockZohoHttpServer | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it("fetches deals on allowlisted paths", async () => {
    server = await startMockZohoHttpServer();
    const client = createZohoRestClient({
      apiBaseUrl: server.apiBaseUrl,
      pinnedOrigin: server.pinnedOrigin,
      accessToken: FAKE_ZOHO_ACCESS_TOKEN,
      requestTimeoutMs: 5_000,
    });
    const result = await client.listDeals({ page: 1, perPage: 25 });
    expect(result).toBeTruthy();
  });

  it("loads deal stage field metadata", async () => {
    server = await startMockZohoHttpServer();
    const client = createZohoRestClient({
      apiBaseUrl: server.apiBaseUrl,
      pinnedOrigin: server.pinnedOrigin,
      accessToken: FAKE_ZOHO_ACCESS_TOKEN,
      requestTimeoutMs: 5_000,
    });
    const fields = await client.listDealStageFields();
    expect(fields).toBeTruthy();
  });

  it("gets a deal by string id", async () => {
    server = await startMockZohoHttpServer();
    const client = createZohoRestClient({
      apiBaseUrl: server.apiBaseUrl,
      pinnedOrigin: server.pinnedOrigin,
      accessToken: FAKE_ZOHO_ACCESS_TOKEN,
      requestTimeoutMs: 5_000,
    });
    const deal = await client.getDeal(FIXTURE_DEAL_ID);
    expect(deal).toBeTruthy();
  });
});
