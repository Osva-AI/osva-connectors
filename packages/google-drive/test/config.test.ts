import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { loadGoogleDriveConfig } from "../src/config.js";

describe("loadGoogleDriveConfig", () => {
  it("loads defaults", () => {
    const config = loadGoogleDriveConfig({});
    expect(config.requestTimeoutMs).toBe(30_000);
    expect(config.maxContentBytes).toBe(262_144);
    expect(config.allowedDriveIds).toBeUndefined();
  });

  it("parses allowed drive ids", () => {
    const config = loadGoogleDriveConfig({
      OSVA_CONNECTOR_GOOGLE_DRIVE_ALLOWED_DRIVE_IDS: "drive_a,drive_b",
    });
    expect(config.allowedDriveIds).toEqual(["drive_a", "drive_b"]);
  });

  it("rejects invalid allowed drive ids", () => {
    expect(() =>
      loadGoogleDriveConfig({
        OSVA_CONNECTOR_GOOGLE_DRIVE_ALLOWED_DRIVE_IDS: "bad id",
      }),
    ).toThrow(ConnectorSdkError);
  });
});
