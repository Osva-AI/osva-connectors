import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { KLAVIYO_API_HOST } from "../src/constants.js";
import {
  assertListLinksSafe,
  extractCursorFromNextLink,
  validatePaginationCursor,
} from "../src/pagination.js";

describe("pagination", () => {
  it("validates cursors", () => {
    expect(validatePaginationCursor("abc123")).toBe("abc123");
    expect(() => validatePaginationCursor("bad cursor!")).toThrow(
      ConnectorSdkError,
    );
  });

  it("extracts cursor from safe next links", () => {
    const cursor = extractCursorFromNextLink(
      {
        next: `${KLAVIYO_API_HOST}/campaigns/?page%5Bcursor%5D=next123`,
      },
      KLAVIYO_API_HOST,
    );
    expect(cursor).toBe("next123");
  });

  it("rejects malicious next link hosts", () => {
    expect(() =>
      assertListLinksSafe(
        { next: "https://evil.example/api/campaigns" },
        KLAVIYO_API_HOST,
      ),
    ).toThrow(ConnectorSdkError);
  });
});
