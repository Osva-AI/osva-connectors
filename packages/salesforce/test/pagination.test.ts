import { afterEach, describe, expect, it } from "vitest";
import { createSalesforceRestClient } from "../src/salesforce-rest-client.js";
import { decodeContinuationToken } from "../src/query-continuation.js";
import { splitQueryResponseEnvelope } from "../src/normalize-salesforce.js";
import {
  FAKE_SALESFORCE_ACCESS_TOKEN,
  startMockSalesforceHttpServer,
  type MockSalesforceHttpServer,
} from "./fixtures/mock-salesforce-http-server.js";

describe("Salesforce query pagination", () => {
  let server: MockSalesforceHttpServer | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it("returns continuation token on first page when more results exist", async () => {
    server = await startMockSalesforceHttpServer();
    const client = createSalesforceRestClient({
      apiDataBaseUrl: server.apiDataBaseUrl,
      pinnedOrigin: server.pinnedOrigin,
      accessToken: FAKE_SALESFORCE_ACCESS_TOKEN,
      requestTimeoutMs: 5_000,
    });
    const raw = await client.listAccounts({ perPage: 1 });
    const { body, continuationToken } = splitQueryResponseEnvelope(raw);
    expect(continuationToken).toBeDefined();
    expect((body as { done?: boolean }).done).toBe(false);
    const payload = decodeContinuationToken(continuationToken!);
    expect(payload.family).toBe("account");
  });

  it("fetches subsequent page via continuation token", async () => {
    server = await startMockSalesforceHttpServer();
    const client = createSalesforceRestClient({
      apiDataBaseUrl: server.apiDataBaseUrl,
      pinnedOrigin: server.pinnedOrigin,
      accessToken: FAKE_SALESFORCE_ACCESS_TOKEN,
      requestTimeoutMs: 5_000,
    });
    const first = await client.listAccounts({ perPage: 1 });
    const { continuationToken } = splitQueryResponseEnvelope(first);
    expect(continuationToken).toBeDefined();
    const second = await client.listAccounts({
      perPage: 1,
      continuationToken,
    });
    const { body } = splitQueryResponseEnvelope(second);
    expect((body as { done?: boolean }).done).toBe(true);
    expect(server.getLocatorFetchCount()).toBe(1);
  });

  it("rejects cross-tool continuation tokens", async () => {
    server = await startMockSalesforceHttpServer();
    const client = createSalesforceRestClient({
      apiDataBaseUrl: server.apiDataBaseUrl,
      pinnedOrigin: server.pinnedOrigin,
      accessToken: FAKE_SALESFORCE_ACCESS_TOKEN,
      requestTimeoutMs: 5_000,
    });
    const first = await client.listAccounts({ perPage: 1 });
    const { continuationToken } = splitQueryResponseEnvelope(first);
    await expect(
      client.listContacts({ perPage: 1, continuationToken }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("surfaces expired query locator failures", async () => {
    server = await startMockSalesforceHttpServer();
    const client = createSalesforceRestClient({
      apiDataBaseUrl: server.apiDataBaseUrl,
      pinnedOrigin: server.pinnedOrigin,
      accessToken: FAKE_SALESFORCE_ACCESS_TOKEN,
      requestTimeoutMs: 5_000,
    });
    const { encodeContinuationToken } =
      await import("../src/query-continuation.js");
    const expired = encodeContinuationToken({
      v: 1,
      family: "account",
      filterFingerprint: "{}",
      locatorSuffix: "/query/locator-expired",
    });
    await expect(
      client.listAccounts({ perPage: 1, continuationToken: expired }),
    ).rejects.toBeTruthy();
  });

  it("honours cancellation", async () => {
    server = await startMockSalesforceHttpServer();
    const client = createSalesforceRestClient({
      apiDataBaseUrl: server.apiDataBaseUrl,
      pinnedOrigin: server.pinnedOrigin,
      accessToken: FAKE_SALESFORCE_ACCESS_TOKEN,
      requestTimeoutMs: 5_000,
    });
    const controller = new AbortController();
    controller.abort();
    await expect(
      client.listAccounts({ perPage: 25 }, controller.signal),
    ).rejects.toBeTruthy();
  });
});
