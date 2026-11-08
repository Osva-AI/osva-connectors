import { describe, expect, it } from "vitest";

import { mapOrderNoteListResponse } from "../src/normalize-woocommerce.js";

describe("WooCommerce PII redaction", () => {
  it("redacts customer notes when includeOrderPii is false", () => {
    const headers = new Headers({ "x-wp-totalpages": "1" });
    const result = mapOrderNoteListResponse(
      [
        {
          id: 1,
          note: "Secret customer note",
          customer_note: true,
          date_created: "2024-01-01",
        },
        {
          id: 2,
          note: "Internal note",
          customer_note: false,
          date_created: "2024-01-02",
        },
      ],
      headers,
      1,
      false,
    );
    const notes = result.notes as Array<{
      note?: string;
      customerNote: boolean;
    }>;
    expect(notes[0]?.note).toBe("[REDACTED]");
    expect(notes[1]?.note).toBe("Internal note");
  });
});
