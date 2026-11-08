import { describe, expect, it } from "vitest";

import { loadBigcommerceConfig } from "../src/config.js";
import {
  BIGCOMMERCE_ACCESS_TOKEN_ENV,
  BIGCOMMERCE_STORE_HASH_ENV,
} from "../src/constants.js";

describe("BigCommerce fixed API host", () => {
  it("defaults to the production Admin API origin", () => {
    const config = loadBigcommerceConfig({
      [BIGCOMMERCE_STORE_HASH_ENV]: "acceptancestore",
      [BIGCOMMERCE_ACCESS_TOKEN_ENV]: "token",
    });
    expect(config.apiHost).toBe("https://api.bigcommerce.com");
  });
});
