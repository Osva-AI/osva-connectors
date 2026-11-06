import { describe, expect, it } from "vitest";

import { mapGmailError } from "../src/map-gmail-error.js";

describe("gmail security regression", () => {
  it("does not leak bearer tokens in mapped errors", () => {
    const secret = "ya29.secret_token_for_redaction_test";
    const err = mapGmailError(new Error(`failed Bearer ${secret}`), {
      accessToken: secret,
    });
    expect(JSON.stringify(err)).not.toContain(secret);
  });
});
