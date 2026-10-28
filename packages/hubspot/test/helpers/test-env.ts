import { createHubspotRestClient } from "../../src/hubspot-rest-client.js";
import {
  FAKE_HUBSPOT_ACCESS_TOKEN,
  type MockHubspotHttpServer,
} from "../fixtures/mock-hubspot-http-server.js";

export function createTestHubspotClient(
  server: MockHubspotHttpServer,
  fetchImpl?: typeof fetch,
) {
  return createHubspotRestClient({
    accessToken: FAKE_HUBSPOT_ACCESS_TOKEN,
    requestTimeoutMs: 5_000,
    apiHost: server.apiOrigin,
    ...(fetchImpl !== undefined ? { fetchImpl } : {}),
  });
}

export { FAKE_HUBSPOT_ACCESS_TOKEN };
