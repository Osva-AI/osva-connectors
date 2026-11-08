import { describe, expect, it } from "vitest";

import { mapBigcommerceError } from "../src/map-bigcommerce-error.js";
import { FAKE_BIGCOMMERCE_ACCESS_TOKEN } from "./helpers/test-env.js";

describe("mapBigcommerceError", () => {
  it("maps unauthorized http errors", () => {
    const error = mapBigcommerceError({ kind: "http", status: 401 });
    expect(error.code).toBe("UNAUTHORIZED");
  });

  it("redacts access tokens from messages", () => {
    const error = mapBigcommerceError(
      new Error(`Failed with ${FAKE_BIGCOMMERCE_ACCESS_TOKEN}`),
      { accessToken: FAKE_BIGCOMMERCE_ACCESS_TOKEN },
    );
    expect(error.message).not.toContain(FAKE_BIGCOMMERCE_ACCESS_TOKEN);
  });
});
