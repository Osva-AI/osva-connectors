import { describe, expect, it } from "vitest";

import { mapCommentListResponse } from "../src/normalize-freshdesk.js";

describe("Freshdesk PII normalization", () => {
  it("redacts public comment bodies", () => {
    const out = mapCommentListResponse(
      {
        comments: [
          { id: 1, public: true, body: "hello customer" },
          { id: 2, public: false, body: "internal" },
        ],
      },
      false,
    );
    expect(out.comments[0]?.body).toBe("[REDACTED_PUBLIC_COMMENT]");
    expect(out.comments[1]?.body).toContain("internal");
  });
});
