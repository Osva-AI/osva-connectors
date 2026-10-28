import { describe, expect, it, afterEach } from "vitest";

import { STRIPE_API_VERSION } from "../src/constants.js";
import {
  FAKE_STRIPE_API_KEY,
  MOCK_BALANCE_TXN_ID,
  startMockStripeHttpServer,
  type MockStripeHttpServer,
} from "./fixtures/mock-stripe-http-server.js";
import { createTestStripeClient } from "./helpers/test-env.js";

describe("createStripeRestClient", () => {
  let server: MockStripeHttpServer | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it("sends Bearer auth and Stripe-Version on account retrieval", async () => {
    server = await startMockStripeHttpServer();
    const client = createTestStripeClient(server);
    await client.getAccount({});
    expect(server.getLastAuthorization()).toBe(`Bearer ${FAKE_STRIPE_API_KEY}`);
    expect(server.getLastStripeVersion()).toBe(STRIPE_API_VERSION);
  });

  it("retries once on rate limit within deadline", async () => {
    server = await startMockStripeHttpServer({ mode: "rate_limit_once" });
    const client = createTestStripeClient(server);
    await client.getBalance({});
    expect(server.getRequestCount()).toBeGreaterThanOrEqual(2);
  });

  it("passes starting_after on balance transaction lists", async () => {
    server = await startMockStripeHttpServer();
    const client = createTestStripeClient(server);
    await client.listBalanceTransactions({
      limit: 10,
      startingAfter: MOCK_BALANCE_TXN_ID,
    });
    expect(server.getLastListUrl()).toContain(
      `starting_after=${MOCK_BALANCE_TXN_ID}`,
    );
  });
});
