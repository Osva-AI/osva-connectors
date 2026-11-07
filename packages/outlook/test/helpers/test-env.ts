import { createGraphRestClient } from "../../src/graph-rest-client.js";
import {
  FAKE_OUTLOOK_ACCESS_TOKEN,
  type MockGraphHttpServer,
} from "../fixtures/mock-graph-http-server.js";

export function createTestOutlookClient(server: MockGraphHttpServer) {
  return createGraphRestClient({
    accessToken: FAKE_OUTLOOK_ACCESS_TOKEN,
    requestTimeoutMs: 5_000,
    graphApiHost: server.graphApiOrigin,
  });
}

export { FAKE_OUTLOOK_ACCESS_TOKEN };
