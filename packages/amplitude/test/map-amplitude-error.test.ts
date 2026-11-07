import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { mapAmplitudeError } from "../src/map-amplitude-error.js";
import type { AmplitudeHttpError } from "../src/amplitude-rest-client.js";

describe("mapAmplitudeError", () => {
  it("maps unauthorized HTTP errors", () => {
    const error: AmplitudeHttpError = { kind: "http", status: 401 };
    const mapped = mapAmplitudeError(error);
    expect(mapped).toBeInstanceOf(ConnectorSdkError);
    expect(mapped.code).toBe("UNAUTHORIZED");
  });

  it("redacts credentials from generic errors", () => {
    const secret = "super-secret-key-value";
    const mapped = mapAmplitudeError(new Error(`failed with ${secret}`), {
      secretKey: secret,
    });
    expect(mapped.message).not.toContain(secret);
  });
});
