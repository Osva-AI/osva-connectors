import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import {
  CAL_ACCESS_TOKEN_ENV,
  CAL_ALLOWED_CALENDARS_ENV,
  CAL_HOST_MUTATIONS_APPROVED_ENV,
  CAL_USE_DOMAIN_DELEGATION_ENV,
  CAL_WRITE_ENABLED_ENV,
} from "../src/constants.js";
import { loadGoogleCalendarConfig } from "../src/config.js";

describe("loadGoogleCalendarConfig", () => {
  it("rejects delegation with static token", () => {
    expect(() =>
      loadGoogleCalendarConfig({
        [CAL_USE_DOMAIN_DELEGATION_ENV]: "true",
        OSVA_CONNECTOR_GOOGLE_CALENDAR_DELEGATED_USER_EMAIL: "u@example.com",
        [CAL_ACCESS_TOKEN_ENV]: "token",
      }),
    ).toThrow(ConnectorSdkError);
  });

  it("requires allowlist when writes enabled", () => {
    expect(() =>
      loadGoogleCalendarConfig({
        [CAL_WRITE_ENABLED_ENV]: "true",
        [CAL_HOST_MUTATIONS_APPROVED_ENV]: "true",
      }),
    ).toThrow(ConnectorSdkError);
  });

  it("accepts read-only defaults", () => {
    const c = loadGoogleCalendarConfig({});
    expect(c.writeEnabled).toBe(false);
    expect(c.allowedCalendarIds).toBeUndefined();
  });

  it("parses explicit empty allowlist as deny-all for reads (env present, empty)", () => {
    const c = loadGoogleCalendarConfig({
      [CAL_ALLOWED_CALENDARS_ENV]: "",
    });
    expect(c.allowedCalendarIds).toEqual([]);
  });

  it("accepts writes with allowlist", () => {
    const c = loadGoogleCalendarConfig({
      [CAL_WRITE_ENABLED_ENV]: "true",
      [CAL_HOST_MUTATIONS_APPROVED_ENV]: "true",
      [CAL_ALLOWED_CALENDARS_ENV]: "primary",
    });
    expect(c.writeEnabled).toBe(true);
  });

  it("accepts writes when allowlist is explicitly empty (deny mutations at runtime)", () => {
    const c = loadGoogleCalendarConfig({
      [CAL_WRITE_ENABLED_ENV]: "true",
      [CAL_HOST_MUTATIONS_APPROVED_ENV]: "true",
      [CAL_ALLOWED_CALENDARS_ENV]: "",
    });
    expect(c.writeEnabled).toBe(true);
    expect(c.allowedCalendarIds).toEqual([]);
  });
});
