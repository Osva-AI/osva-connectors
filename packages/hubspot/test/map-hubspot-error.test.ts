import { describe, expect, it } from "vitest";

import { mapHubspotError } from "../src/map-hubspot-error.js";

describe("mapHubspotError", () => {
  it("maps rate limit http errors", () => {
    const mapped = mapHubspotError({
      kind: "http",
      status: 429,
      hubspotCategory: "RATE_LIMIT",
    });
    expect(mapped.code).toBe("RATE_LIMITED");
  });

  it("redacts bearer tokens in unexpected errors", () => {
    const token = "pat-na1-secret-token-value";
    const mapped = mapHubspotError(
      new Error(`Failed Bearer ${token} upstream`),
    );
    expect(mapped.message).not.toContain(token);
  });
});
