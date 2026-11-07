import { createExaRestClient } from "../../src/exa-rest-client.js";
import {
  FAKE_EXA_API_KEY,
  type MockExaHttpServer,
} from "../fixtures/mock-exa-http-server.js";

export function createTestExaClient(server: MockExaHttpServer) {
  return createExaRestClient({
    apiKey: FAKE_EXA_API_KEY,
    requestTimeoutMs: 5_000,
    apiHost: server.apiOrigin,
  });
}

export { FAKE_EXA_API_KEY };
