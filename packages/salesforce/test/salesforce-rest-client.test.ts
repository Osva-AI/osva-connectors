import { afterEach, describe, expect, it } from "vitest";
import { createSalesforceRestClient } from "../src/salesforce-rest-client.js";
import {
  FAKE_SALESFORCE_ACCESS_TOKEN,
  FIXTURE_ACCOUNT_ID,
  FIXTURE_OPPORTUNITY_ID,
  startMockSalesforceHttpServer,
  type MockSalesforceHttpServer,
} from "./fixtures/mock-salesforce-http-server.js";

describe("Salesforce rest client", () => {
  let server: MockSalesforceHttpServer | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it("fetches accounts on allowlisted paths", async () => {
    server = await startMockSalesforceHttpServer();
    const client = createSalesforceRestClient({
      apiDataBaseUrl: server.apiDataBaseUrl,
      pinnedOrigin: server.pinnedOrigin,
      accessToken: FAKE_SALESFORCE_ACCESS_TOKEN,
      requestTimeoutMs: 5_000,
    });
    const result = await client.listAccounts({ perPage: 25 });
    expect(result).toBeTruthy();
  });

  it("rejects disallowed origins", async () => {
    server = await startMockSalesforceHttpServer();
    const client = createSalesforceRestClient({
      apiDataBaseUrl: server.apiDataBaseUrl,
      pinnedOrigin: "http://evil.test",
      accessToken: FAKE_SALESFORCE_ACCESS_TOKEN,
      requestTimeoutMs: 5_000,
    });
    await expect(client.getAccount(FIXTURE_ACCOUNT_ID)).rejects.toMatchObject({
      code: "PROVIDER_ERROR",
    });
  });

  it("patches opportunity stage on allowlisted path", async () => {
    server = await startMockSalesforceHttpServer();
    const client = createSalesforceRestClient({
      apiDataBaseUrl: server.apiDataBaseUrl,
      pinnedOrigin: server.pinnedOrigin,
      accessToken: FAKE_SALESFORCE_ACCESS_TOKEN,
      requestTimeoutMs: 5_000,
    });
    await client.setOpportunityStage(FIXTURE_OPPORTUNITY_ID, {
      StageName: "Prospecting",
    });
    expect(server.getStagePatchCount()).toBe(1);
  });
});
