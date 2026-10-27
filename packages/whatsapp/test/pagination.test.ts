import { describe, expect, it } from "vitest";

import { META_GRAPH_API_HOST } from "../src/constants.js";
import { assertPagingLinksSafe } from "../src/pagination.js";

describe("WhatsApp pagination safety", () => {
  it("rejects off-host next URLs", () => {
    expect(() =>
      assertPagingLinksSafe(
        { next: "https://evil.example.com/v26.0/next" },
        META_GRAPH_API_HOST,
      ),
    ).toThrow(/host is not allowlisted/);
  });
});
