import { describe, expect, it, afterEach } from "vitest";

import { createZendeskRestClient } from "../src/zendesk-rest-client.js";
import {
  FAKE_ZENDESK_API_TOKEN,
  FAKE_ZENDESK_EMAIL,
  startMockZendeskHttpServer,
  type MockZendeskHttpServer,
} from "./fixtures/mock-zendesk-http-server.js";

describe("zendesk rest client", () => {
  let server: MockZendeskHttpServer | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it("fetches tickets on allowlisted paths", async () => {
    server = await startMockZendeskHttpServer();
    const client = createZendeskRestClient({
      apiBaseUrl: server.apiBaseUrl,
      pinnedOrigin: server.pinnedOrigin,
      email: FAKE_ZENDESK_EMAIL,
      apiToken: FAKE_ZENDESK_API_TOKEN,
      requestTimeoutMs: 5_000,
    });
    const result = await client.listTickets({ limit: 25 });
    expect(result.items).toBeTruthy();
  });
});
