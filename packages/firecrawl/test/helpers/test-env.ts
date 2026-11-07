import { createFirecrawlRestClient } from "../../src/firecrawl-rest-client.js";
import {
  FAKE_FIRECRAWL_API_KEY,
  type MockFirecrawlHttpServer,
} from "../fixtures/mock-firecrawl-http-server.js";

export function createTestFirecrawlClient(
  server: MockFirecrawlHttpServer,
  fetchImpl?: typeof fetch,
) {
  return createFirecrawlRestClient({
    apiKey: FAKE_FIRECRAWL_API_KEY,
    requestTimeoutMs: 5_000,
    apiHost: server.apiOrigin,
    ...(fetchImpl !== undefined ? { fetchImpl } : {}),
  });
}

export { FAKE_FIRECRAWL_API_KEY };
