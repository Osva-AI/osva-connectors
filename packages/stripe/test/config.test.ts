import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { loadStripeConfig } from "../src/config.js";
import {
  STRIPE_ALLOWED_CUSTOMERS_ENV,
  STRIPE_ALLOW_LIVE_MODE_ENV,
  STRIPE_API_KEY_ENV,
} from "../src/constants.js";
import { FAKE_STRIPE_API_KEY } from "./fixtures/mock-stripe-http-server.js";
import {
  syntheticInvalidApiKeyShape,
  syntheticStripeLiveRestrictedKey,
  syntheticStripeLiveSecretKey,
  syntheticStripeTestRestrictedKey,
} from "./helpers/synthetic-stripe-keys.js";

describe("loadStripeConfig", () => {
  it("loads test secret keys by default", () => {
    const config = loadStripeConfig({
      [STRIPE_API_KEY_ENV]: FAKE_STRIPE_API_KEY,
    });
    expect(config.allowLiveMode).toBe(false);
    expect(config.maxRows).toBe(100);
  });

  it("parses allowed customers", () => {
    const config = loadStripeConfig({
      [STRIPE_API_KEY_ENV]: FAKE_STRIPE_API_KEY,
      [STRIPE_ALLOWED_CUSTOMERS_ENV]: "cus_a,cus_b",
    });
    expect(config.allowedCustomerIds).toEqual(["cus_a", "cus_b"]);
  });

  it("rejects live keys when live mode is disabled", () => {
    expect(() =>
      loadStripeConfig({
        [STRIPE_API_KEY_ENV]: syntheticStripeLiveSecretKey(),
      }),
    ).toThrow(ConnectorSdkError);
  });

  it("rejects live restricted keys when live mode is disabled", () => {
    expect(() =>
      loadStripeConfig({
        [STRIPE_API_KEY_ENV]: syntheticStripeLiveRestrictedKey(),
      }),
    ).toThrow(ConnectorSdkError);
  });

  it("allows test restricted keys when live mode is disabled", () => {
    const config = loadStripeConfig({
      [STRIPE_API_KEY_ENV]: syntheticStripeTestRestrictedKey(),
    });
    expect(config.allowLiveMode).toBe(false);
  });

  it("allows restricted live keys when explicitly enabled", () => {
    const config = loadStripeConfig({
      [STRIPE_API_KEY_ENV]: syntheticStripeLiveRestrictedKey(),
      [STRIPE_ALLOW_LIVE_MODE_ENV]: "true",
    });
    expect(config.allowLiveMode).toBe(true);
  });

  it("rejects unsupported key shapes", () => {
    expect(() =>
      loadStripeConfig({
        [STRIPE_API_KEY_ENV]: syntheticInvalidApiKeyShape(),
      }),
    ).toThrow(ConnectorSdkError);
  });

  it("rejects missing credentials", () => {
    expect(() => loadStripeConfig({})).toThrow(ConnectorSdkError);
  });
});
