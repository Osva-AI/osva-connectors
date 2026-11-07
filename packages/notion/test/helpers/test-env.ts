import { createNotionRestClient } from "../../src/notion-rest-client.js";
import {
  FAKE_NOTION_ACCESS_TOKEN,
  type MockNotionHttpServer,
} from "../fixtures/mock-notion-http-server.js";

export function createTestNotionClient(server: MockNotionHttpServer) {
  return createNotionRestClient({
    accessToken: FAKE_NOTION_ACCESS_TOKEN,
    requestTimeoutMs: 5_000,
    apiVersion: "2026-03-11",
    apiHost: server.apiOrigin,
  });
}

export { FAKE_NOTION_ACCESS_TOKEN };
