import { describe, expect, it } from "vitest";

import { mapCommentListResponse } from "../src/normalize-zendesk.js";

describe("Zendesk PII normalization", () => {
  it("redacts public comment bodies", () => {
    const out = mapCommentListResponse(
      {
        comments: [
          { id: 1, public: true, body: "hello customer" },
          { id: 2, public: false, body: "internal" },
        ],
      },
      undefined,
      false,
    );
    expect(out.comments[0]?.body).toBe("[REDACTED_PUBLIC_COMMENT]");
    expect(out.comments[1]?.body).toContain("internal");
  });
});
