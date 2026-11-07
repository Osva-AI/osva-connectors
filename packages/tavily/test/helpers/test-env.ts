import { createTavilyRestClient } from "../../src/tavily-rest-client.js";
import {
  FAKE_TAVILY_API_KEY,
  type MockTavilyHttpServer,
} from "../fixtures/mock-tavily-http-server.js";

export function createTestTavilyClient(server: MockTavilyHttpServer) {
  return createTavilyRestClient({
    apiKey: FAKE_TAVILY_API_KEY,
    requestTimeoutMs: 5_000,
    apiHost: server.apiOrigin,
  });
}

export { FAKE_TAVILY_API_KEY };
