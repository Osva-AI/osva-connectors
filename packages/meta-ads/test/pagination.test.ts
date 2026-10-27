import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import {
  assertPagingLinksSafe,
  validatePaginationCursor,
} from "../src/pagination.js";

describe("pagination safety", () => {
  it("validates cursors", () => {
    expect(validatePaginationCursor("abc123")).toBe("abc123");
    expect(() => validatePaginationCursor("bad cursor!")).toThrow(
      ConnectorSdkError,
    );
  });

  it("rejects malicious paging hosts", () => {
    expect(() =>
      assertPagingLinksSafe(
        { next: "https://evil.example.com/v26.0/me/adaccounts" },
        "https://graph.facebook.com",
      ),
    ).toThrow(ConnectorSdkError);
  });

  it("allows safe paging metadata on fixed host", () => {
    expect(() =>
      assertPagingLinksSafe(
        {
          next: "https://graph.facebook.com/v26.0/me/adaccounts?after=cursor",
        },
        "https://graph.facebook.com",
      ),
    ).not.toThrow();
  });
});
