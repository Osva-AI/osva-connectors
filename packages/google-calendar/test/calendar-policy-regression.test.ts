import { describe, expect, it } from "vitest";

import {
  eventListInputSchema,
  freeBusyQueryInputSchema,
} from "../src/tool-schemas.js";

describe("Google Calendar policy regressions", () => {
  it("rejects freeBusy when timeMin is not strictly before timeMax", () => {
    expect(
      freeBusyQueryInputSchema.safeParse({
        timeMin: "2025-01-02T00:00:00Z",
        timeMax: "2025-01-01T00:00:00Z",
        items: [{ id: "primary" }],
      }).success,
    ).toBe(false);
    expect(
      freeBusyQueryInputSchema.safeParse({
        timeMin: "2025-01-01T00:00:00Z",
        timeMax: "2025-01-01T00:00:00Z",
        items: [{ id: "primary" }],
      }).success,
    ).toBe(false);
  });

  it("accepts freeBusy when timeMin is before timeMax", () => {
    const r = freeBusyQueryInputSchema.safeParse({
      timeMin: "2025-01-01T00:00:00Z",
      timeMax: "2025-01-02T00:00:00Z",
      items: [{ id: "primary" }],
    });
    expect(r.success).toBe(true);
  });

  it("rejects event.list when both time bounds are set in wrong order", () => {
    expect(
      eventListInputSchema.safeParse({
        calendarId: "primary",
        timeMin: "2025-01-02T00:00:00Z",
        timeMax: "2025-01-01T00:00:00Z",
      }).success,
    ).toBe(false);
  });

  it("allows event.list with only timeMin or only timeMax", () => {
    expect(
      eventListInputSchema.safeParse({
        calendarId: "primary",
        timeMin: "2025-01-01T00:00:00Z",
      }).success,
    ).toBe(true);
    expect(
      eventListInputSchema.safeParse({
        calendarId: "primary",
        timeMax: "2025-01-01T00:00:00Z",
      }).success,
    ).toBe(true);
  });
});
