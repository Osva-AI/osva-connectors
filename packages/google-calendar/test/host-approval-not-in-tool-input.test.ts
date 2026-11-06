import { describe, expect, it } from "vitest";

import { eventCreateInputSchema } from "../src/tool-schemas.js";

describe("Google Calendar: host approval is not a tool input field", () => {
  it("event create schema has no write or host approval keys", () => {
    const keys = Object.keys(eventCreateInputSchema.shape);
    expect(keys).toEqual(["calendarId", "event", "sendUpdates"]);
    expect(keys).not.toContain("writeEnabled");
    expect(keys).not.toContain("hostMutationsApproved");
    expect(keys).not.toContain("allowedCalendarIds");
  });
});
