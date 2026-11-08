import { afterEach, describe, expect, it } from "vitest";

import { createPipedriveRestClient } from "../src/pipedrive-rest-client.js";
import {
  FAKE_PIPEDRIVE_API_TOKEN,
  startMockPipedriveHttpServer,
  type MockPipedriveHttpServer,
} from "./fixtures/mock-pipedrive-http-server.js";

describe("Pipedrive rest client", () => {
  let server: MockPipedriveHttpServer | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it("fetches deals on allowlisted paths", async () => {
    server = await startMockPipedriveHttpServer();
    const client = createPipedriveRestClient({
      apiBaseUrl: server.apiBaseUrl,
      pinnedOrigin: server.pinnedOrigin,
      apiToken: FAKE_PIPEDRIVE_API_TOKEN,
      requestTimeoutMs: 5_000,
    });
    const result = await client.listDeals({ limit: 25 });
    expect(result.items).toBeTruthy();
  });
});
