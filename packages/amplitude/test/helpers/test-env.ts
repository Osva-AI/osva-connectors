import { createAmplitudeRestClient } from "../../src/amplitude-rest-client.js";
import {
  FAKE_AMPLITUDE_API_KEY,
  FAKE_AMPLITUDE_SECRET_KEY,
  type MockAmplitudeHttpServer,
} from "../fixtures/mock-amplitude-http-server.js";

export function createTestAmplitudeClient(
  server: MockAmplitudeHttpServer,
  fetchImpl?: typeof fetch,
) {
  return createAmplitudeRestClient({
    apiKey: FAKE_AMPLITUDE_API_KEY,
    secretKey: FAKE_AMPLITUDE_SECRET_KEY,
    requestTimeoutMs: 5_000,
    apiHost: server.apiOrigin,
    ...(fetchImpl !== undefined ? { fetchImpl } : {}),
  });
}

export { FAKE_AMPLITUDE_API_KEY, FAKE_AMPLITUDE_SECRET_KEY };
