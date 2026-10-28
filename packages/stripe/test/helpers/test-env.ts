import { createStripeRestClient } from "../../src/stripe-rest-client.js";
import type { StripeClient } from "../../src/stripe-client.js";
import {
  FAKE_STRIPE_API_KEY,
  type MockStripeHttpServer,
} from "../fixtures/mock-stripe-http-server.js";

export function createTestStripeClient(
  server: MockStripeHttpServer,
  apiKey: string = FAKE_STRIPE_API_KEY,
): StripeClient {
  return createStripeRestClient({
    apiKey,
    requestTimeoutMs: 5_000,
    apiHost: server.apiOrigin,
  });
}
