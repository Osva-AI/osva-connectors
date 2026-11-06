import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import {
  assertCalendarAllowed,
  createCalendarAllowlist,
} from "../src/calendar-allowlist.js";

describe("calendar allowlist", () => {
  it("createCalendarAllowlist(undefined) means unrestricted reads", () => {
    expect(createCalendarAllowlist(undefined)).toBeUndefined();
  });

  it("createCalendarAllowlist([]) is an explicit deny-all policy object", () => {
    const a = createCalendarAllowlist([]);
    expect(a).toBeDefined();
    expect(a!.allowedIds.size).toBe(0);
  });

  it("assertCalendarAllowed denies every id when allowlist is empty", () => {
    const allowlist = createCalendarAllowlist([]);
    expect(() =>
      assertCalendarAllowed(allowlist!, "primary", "calendarId"),
    ).toThrow(ConnectorSdkError);
  });
});
