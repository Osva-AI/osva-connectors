import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import {
  buildIntercomContactSearchBody,
  buildIntercomConversationSearchBody,
} from "../src/mutation-allowlist.js";

describe("Intercom search pagination bodies", () => {
  it("sends first-page conversation search without starting_after", () => {
    const body = buildIntercomConversationSearchBody("billing", { page: 1 });
    expect(body).toEqual({
      query: { field: "source.body", operator: "~", value: "billing" },
      pagination: { per_page: 20 },
    });
  });

  it("sends starting_after when cursor is provided", () => {
    const body = buildIntercomConversationSearchBody("billing", {
      startingAfter: "cursor_abc",
    });
    expect(body.pagination).toEqual({
      per_page: 20,
      starting_after: "cursor_abc",
    });
  });

  it("rejects page > 1 without startingAfter", () => {
    expect(() => buildIntercomContactSearchBody("name", { page: 2 })).toThrow(
      ConnectorSdkError,
    );
  });

  it("rejects combining startingAfter with page > 1", () => {
    expect(() =>
      buildIntercomContactSearchBody("name", {
        page: 2,
        startingAfter: "cursor_abc",
      }),
    ).toThrow(ConnectorSdkError);
  });
});
