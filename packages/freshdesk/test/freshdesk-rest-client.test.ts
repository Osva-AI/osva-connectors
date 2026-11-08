import { afterEach, describe, expect, it } from "vitest";

import { createFreshdeskRestClient } from "../src/freshdesk-rest-client.js";
import {
  FAKE_FRESHDESK_API_KEY,
  startMockFreshdeskHttpServer,
  type MockFreshdeskHttpServer,
} from "./fixtures/mock-freshdesk-http-server.js";

describe("Freshdesk rest client", () => {
  let server: MockFreshdeskHttpServer | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it("fetches tickets on allowlisted paths", async () => {
    server = await startMockFreshdeskHttpServer();
    const client = createFreshdeskRestClient({
      apiBaseUrl: server.apiBaseUrl,
      pinnedOrigin: server.pinnedOrigin,
      apiKey: FAKE_FRESHDESK_API_KEY,
      requestTimeoutMs: 5_000,
    });
    const result = await client.listTickets({ page: 1, perPage: 25 });
    expect(result.items).toBeTruthy();
  });
});
