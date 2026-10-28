import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { HUBSPOT_API_HOST } from "../src/constants.js";
import {
  assertPagingLinksSafe,
  extractAfterCursor,
  validatePaginationCursor,
} from "../src/pagination.js";

describe("pagination", () => {
  it("validates cursors", () => {
    expect(validatePaginationCursor("abc123")).toBe("abc123");
    expect(() => validatePaginationCursor("bad cursor!")).toThrow(
      ConnectorSdkError,
    );
  });

  it("extracts after cursor from safe paging metadata", () => {
    const cursor = extractAfterCursor(
      {
        next: {
          after: "next123",
          link: `${HUBSPOT_API_HOST}/crm/objects/2026-09/contacts?after=next123`,
        },
      },
      HUBSPOT_API_HOST,
    );
    expect(cursor).toBe("next123");
  });

  it("rejects malicious pagination link hosts", () => {
    expect(() =>
      assertPagingLinksSafe(
        {
          next: {
            after: "next123",
            link: "https://evil.example/crm/objects/contacts",
          },
        },
        HUBSPOT_API_HOST,
      ),
    ).toThrow(ConnectorSdkError);
  });
});
