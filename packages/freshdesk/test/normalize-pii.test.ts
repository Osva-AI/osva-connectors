import { describe, expect, it } from "vitest";

import { mapCommentListResponse } from "../src/normalize-freshdesk.js";

describe("Freshdesk PII normalization", () => {
  it("does not treat Zendesk public flag as Freshdesk privacy", () => {
    const out = mapCommentListResponse(
      {
        comments: [
          { id: 1, public: true, body: "hello customer" },
          { id: 2, private: true, body: "internal" },
        ],
      },
      false,
    );
    expect(out.comments[0]?.body).toBe("[REDACTED_CUSTOMER_CONTENT]");
    expect(out.comments[1]?.body).toContain("internal");
  });
});
