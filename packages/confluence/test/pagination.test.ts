import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import {
  assertNextLinkAllowed,
  extractCursorFromNextLink,
  parseConfluenceV2ListResponse,
} from "../src/pagination.js";

describe("confluence pagination", () => {
  const allowed = ["https://example.atlassian.net/wiki/api/v2"];

  it("extracts cursor from relative next link", () => {
    const cursor = extractCursorFromNextLink(
      "/wiki/api/v2/spaces?limit=25&cursor=abc123",
      allowed,
    );
    expect(cursor).toBe("abc123");
  });

  it("rejects external next link hosts", () => {
    expect(() =>
      assertNextLinkAllowed("https://evil.example/next", allowed),
    ).toThrow(ConnectorSdkError);
  });

  it("parses v2 list envelope", () => {
    const parsed = parseConfluenceV2ListResponse(
      {
        results: [{ id: "1" }],
        _links: { next: "/wiki/api/v2/spaces?cursor=cursor_fixture" },
      },
      allowed,
    );
    expect(parsed.results).toHaveLength(1);
    expect(parsed.nextCursor).toBe("cursor_fixture");
  });
});
