import { describe, expect, it } from "vitest";

import { mapCommentListResponse } from "../src/normalize-freshdesk.js";

describe("Freshdesk conversation privacy", () => {
  it("redacts public customer replies using Freshdesk incoming/private semantics", () => {
    const out = mapCommentListResponse(
      {
        comments: [
          { id: 1, private: false, incoming: true, body: "customer secret" },
          { id: 2, private: true, body: "internal note" },
          { id: 3, private: false, incoming: false, body: "agent reply" },
          { id: 4, body: "missing visibility" },
        ],
      },
      false,
    );
    expect(out.comments[0]?.body).toBe("[REDACTED_CUSTOMER_CONTENT]");
    expect(out.comments[1]?.body).toContain("internal note");
    expect(out.comments[2]?.body).toBe("[REDACTED_PUBLIC_REPLY]");
    expect(out.comments[3]?.body).toBe("[REDACTED_CUSTOMER_CONTENT]");
  });

  it("returns bodies when INCLUDE_PII is enabled", () => {
    const out = mapCommentListResponse(
      {
        comments: [{ id: 1, private: false, incoming: true, body: "visible" }],
      },
      true,
    );
    expect(out.comments[0]?.body).toContain("visible");
  });
});
