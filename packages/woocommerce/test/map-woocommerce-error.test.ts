import { describe, expect, it } from "vitest";

import { mapWoocommerceError } from "../src/map-woocommerce-error.js";
import { FAKE_WOOCOMMERCE_CONSUMER_SECRET } from "./helpers/test-env.js";

describe("mapWoocommerceError", () => {
  it("maps unauthorized http errors", () => {
    const error = mapWoocommerceError({ kind: "http", status: 401 });
    expect(error.code).toBe("UNAUTHORIZED");
  });

  it("redacts consumer secrets from messages", () => {
    const error = mapWoocommerceError(
      new Error(`Failed with ${FAKE_WOOCOMMERCE_CONSUMER_SECRET}`),
      { consumerSecret: FAKE_WOOCOMMERCE_CONSUMER_SECRET },
    );
    expect(error.message).not.toContain(FAKE_WOOCOMMERCE_CONSUMER_SECRET);
  });

  it("marks ambiguous write server errors", () => {
    const error = mapWoocommerceError(
      { kind: "http", status: 502 },
      { ambiguousWrite: true },
    );
    expect(error.message).toContain("ambiguous");
  });
});
