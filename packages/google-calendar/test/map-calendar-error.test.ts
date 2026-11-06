import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { mapCalendarError } from "../src/map-calendar-error.js";

describe("mapCalendarError", () => {
  it("maps 403 to FORBIDDEN", () => {
    const err = mapCalendarError({ kind: "http", status: 403 });
    expect(err).toBeInstanceOf(ConnectorSdkError);
    expect(err.code).toBe("FORBIDDEN");
  });

  it("maps ambiguous 500", () => {
    const err = mapCalendarError(
      { kind: "http", status: 500 },
      { ambiguousMutation: true },
    );
    expect(err.code).toBe("PROVIDER_ERROR");
    expect(err.retryable).toBe(false);
  });
});
