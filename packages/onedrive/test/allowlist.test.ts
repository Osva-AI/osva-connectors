import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import {
  assertDriveIdAllowed,
  assertDriveRecordAllowed,
  assertRootItemIdForList,
  createDriveAllowlist,
  createRootItemAllowlist,
} from "../src/allowlist.js";

describe("onedrive allowlists", () => {
  const driveAllowlist = createDriveAllowlist(["allowed_drive"]);
  const rootAllowlist = createRootItemAllowlist(["allowed_folder"]);

  it("allows configured drive id", () => {
    expect(() =>
      assertDriveIdAllowed(driveAllowlist, "allowed_drive"),
    ).not.toThrow();
  });

  it("rejects unknown drive id", () => {
    expect(() => assertDriveIdAllowed(driveAllowlist, "other")).toThrow(
      ConnectorSdkError,
    );
  });

  it("rejects empty explicit drive allowlist", () => {
    const empty = createDriveAllowlist([]);
    expect(() => assertDriveRecordAllowed(empty, "any")).toThrow(
      ConnectorSdkError,
    );
  });

  it("requires folder id for list when root allowlist configured", () => {
    expect(() => assertRootItemIdForList(rootAllowlist, undefined)).toThrow(
      ConnectorSdkError,
    );
  });

  it("allows listed folder id", () => {
    expect(() =>
      assertRootItemIdForList(rootAllowlist, "allowed_folder"),
    ).not.toThrow();
  });
});
