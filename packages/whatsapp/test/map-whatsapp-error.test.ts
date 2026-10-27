import { describe, expect, it } from "vitest";

import { mapWhatsAppError } from "../src/map-whatsapp-error.js";

describe("mapWhatsAppError", () => {
  it("redacts bearer tokens in unexpected errors", () => {
    const token = "EAAsecretTokenValue1234567890";
    const mapped = mapWhatsAppError(new Error(`Failure Bearer ${token}`), {
      accessToken: token,
    });
    expect(mapped.message).not.toContain(token);
  });

  it("marks ambiguous send timeouts as non-retryable guidance", () => {
    const timeout = new Error("WhatsApp request timed out.");
    timeout.name = "TimeoutError";
    const mapped = mapWhatsAppError(timeout, { ambiguousSend: true });
    expect(mapped.retryable).not.toBe(true);
    expect(mapped.message).toContain("indeterminate");
  });
});
