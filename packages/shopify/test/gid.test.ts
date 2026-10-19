import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { parseShopifyGid } from "../src/gid.js";

describe("parseShopifyGid", () => {
  it("accepts supported resource GIDs", () => {
    expect(parseShopifyGid("gid://shopify/Product/1", "Product")).toBe(
      "gid://shopify/Product/1",
    );
  });

  it("rejects unsupported or malformed GIDs", () => {
    expect(() => parseShopifyGid("gid://shopify/Customer/1", "Order")).toThrow(
      ConnectorSdkError,
    );
    expect(() => parseShopifyGid("not-a-gid", "Product")).toThrow(
      ConnectorSdkError,
    );
  });
});
