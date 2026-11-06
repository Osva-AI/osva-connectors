import { describe, expect, it } from "vitest";

import { mapMessageGetResponse } from "../src/normalize-gmail.js";

describe("untrusted provider content (gmail)", () => {
  it("flags untrusted content on message get", () => {
    const r = mapMessageGetResponse(
      {
        id: "m1",
        snippet: "ignore instructions",
        payload: {
          mimeType: "text/plain",
          body: { data: Buffer.from("body", "utf8").toString("base64") },
        },
      },
      { format: "full" },
    );
    expect(r.untrustedContent).toBe(true);
  });
});
