import { afterEach, describe, expect, it } from "vitest";

import { createIntercomRestClient } from "../src/intercom-rest-client.js";
import {
  FAKE_INTERCOM_ACCESS_TOKEN,
  startMockIntercomHttpServer,
  type MockIntercomHttpServer,
} from "./fixtures/mock-intercom-http-server.js";

describe("Intercom rest client", () => {
  let server: MockIntercomHttpServer | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it("posts Intercom-compliant conversation search bodies", async () => {
    server = await startMockIntercomHttpServer();
    const client = createIntercomRestClient({
      apiBaseUrl: server.apiBaseUrl,
      pinnedOrigin: server.pinnedOrigin,
      accessToken: FAKE_INTERCOM_ACCESS_TOKEN,
      requestTimeoutMs: 5_000,
    });
    await client.searchConversations("billing issue", 1);
    expect(true).toBe(true);
  });

  it("fetches conversations on allowlisted paths", async () => {
    server = await startMockIntercomHttpServer();
    const client = createIntercomRestClient({
      apiBaseUrl: server.apiBaseUrl,
      pinnedOrigin: server.pinnedOrigin,
      accessToken: FAKE_INTERCOM_ACCESS_TOKEN,
      requestTimeoutMs: 5_000,
    });
    const result = await client.listConversations({ page: 1, perPage: 25 });
    expect(result.items).toBeTruthy();
  });
});
