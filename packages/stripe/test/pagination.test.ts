import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import {
  parseStripeListResponse,
  validatePaginationCursor,
} from "../src/pagination.js";

describe("Stripe pagination", () => {
  it("validates starting_after cursors", () => {
    expect(validatePaginationCursor("pi_abc123")).toBe("pi_abc123");
    expect(() => validatePaginationCursor("bad cursor!")).toThrow(
      ConnectorSdkError,
    );
  });

  it("derives next cursor from has_more and last id", () => {
    const parsed = parseStripeListResponse({
      object: "list",
      data: [{ id: "txn_001" }, { id: "txn_002" }],
      has_more: true,
      url: "/v1/balance_transactions",
    });
    expect(parsed.lastId).toBe("txn_002");
    expect(parsed.hasMore).toBe(true);
  });

  it("rejects untrusted list URLs on other hosts", () => {
    expect(() =>
      parseStripeListResponse({
        object: "list",
        data: [],
        has_more: false,
        url: "https://evil.example/v1/balance_transactions",
      }),
    ).toThrow(ConnectorSdkError);
  });
});
