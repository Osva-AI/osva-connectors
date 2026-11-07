import { createLinearGraphqlClient } from "../../src/linear-graphql-client.js";
import {
  FAKE_LINEAR_API_KEY,
  type MockLinearGraphqlServer,
} from "../fixtures/mock-linear-graphql-server.js";

export function createTestLinearClient(server: MockLinearGraphqlServer) {
  return createLinearGraphqlClient({
    authorizationHeader: FAKE_LINEAR_API_KEY,
    requestTimeoutMs: 5_000,
    apiHost: server.graphqlUrl,
  });
}

export { FAKE_LINEAR_API_KEY };
