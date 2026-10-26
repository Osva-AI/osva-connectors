import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import {
  assertDriveIdAllowed,
  assertFileAccessibleUnderAllowlist,
  createDriveAllowlist,
} from "../src/allowlist.js";

describe("drive allowlist", () => {
  const allowlist = createDriveAllowlist(["allowed_drive"]);

  it("allows configured drive id", () => {
    expect(() =>
      assertDriveIdAllowed(allowlist, "allowed_drive", "driveId parameter"),
    ).not.toThrow();
  });

  it("rejects unknown drive id", () => {
    expect(() =>
      assertDriveIdAllowed(allowlist, "other", "driveId parameter"),
    ).toThrow(ConnectorSdkError);
  });

  it("rejects My Drive files when allowlist is configured", () => {
    expect(() =>
      assertFileAccessibleUnderAllowlist(allowlist, { driveId: undefined }),
    ).toThrow(ConnectorSdkError);
  });
});
