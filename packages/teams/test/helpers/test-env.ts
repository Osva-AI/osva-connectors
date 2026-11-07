import { createGraphRestClient } from "../../src/graph-rest-client.js";
import {
  FAKE_TEAMS_ACCESS_TOKEN,
  type MockTeamsHttpServer,
} from "../fixtures/mock-teams-http-server.js";

export function createTestTeamsClient(server: MockTeamsHttpServer) {
  return createGraphRestClient({
    accessToken: FAKE_TEAMS_ACCESS_TOKEN,
    requestTimeoutMs: 5_000,
    graphApiBase: server.graphApiOrigin,
  });
}

export { FAKE_TEAMS_ACCESS_TOKEN };
