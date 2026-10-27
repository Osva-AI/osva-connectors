import { createKlaviyoRestClient } from "../../src/klaviyo-rest-client.js";
import {
  FAKE_KLAVIYO_PRIVATE_API_KEY,
  type MockKlaviyoHttpServer,
} from "../fixtures/mock-klaviyo-http-server.js";

export function createTestKlaviyoClient(
  server: MockKlaviyoHttpServer,
  fetchImpl?: typeof fetch,
) {
  return createKlaviyoRestClient({
    privateApiKey: FAKE_KLAVIYO_PRIVATE_API_KEY,
    requestTimeoutMs: 5_000,
    apiHost: server.apiOrigin,
    ...(fetchImpl !== undefined ? { fetchImpl } : {}),
  });
}

export { FAKE_KLAVIYO_PRIVATE_API_KEY };
