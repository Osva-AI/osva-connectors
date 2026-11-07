import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { mapTeamsError } from "../src/map-teams-error.js";

describe("mapTeamsError", () => {
  it("maps Graph 401 to UNAUTHORIZED", () => {
    const err = mapTeamsError({
      kind: "http",
      status: 401,
      graphCode: "InvalidAuthenticationToken",
    });
    expect(err).toBeInstanceOf(ConnectorSdkError);
    expect(err.code).toBe("UNAUTHORIZED");
  });

  it("marks ambiguous send timeouts as non-retryable", () => {
    const err = mapTeamsError(new Error("Microsoft Graph request timed out."), {
      ambiguousMutation: true,
    });
    expect(err.code).toBe("TIMEOUT");
    expect(err.retryable).toBe(false);
  });
});
