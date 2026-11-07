import { createConfluenceRestClient } from "../../src/confluence-rest-client.js";
import type { ConfluenceClient } from "../../src/confluence-client.js";
import {
  FAKE_CONFLUENCE_ACCESS_TOKEN,
  type MockConfluenceHttpServer,
} from "../fixtures/mock-confluence-http-server.js";

export function createTestConfluenceClient(
  server: MockConfluenceHttpServer,
  authorizationHeader: string = `Bearer ${FAKE_CONFLUENCE_ACCESS_TOKEN}`,
): ConfluenceClient {
  return createConfluenceRestClient({
    apiBaseV2: server.apiOriginV2,
    apiBaseRest: server.apiOriginRest,
    authorizationHeader,
    requestTimeoutMs: 5_000,
  });
}
