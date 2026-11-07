import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { loadOneDriveConfig } from "../src/config.js";
import {
  ONEDRIVE_ACCESS_TOKEN_ENV,
  ONEDRIVE_ALLOWED_DRIVE_IDS_ENV,
  ONEDRIVE_ALLOWED_UPLOAD_FOLDER_IDS_ENV,
  ONEDRIVE_HOST_WRITES_APPROVED_ENV,
  ONEDRIVE_WRITE_ENABLED_ENV,
} from "../src/constants.js";

describe("loadOneDriveConfig", () => {
  it("requires access token", () => {
    expect(() => loadOneDriveConfig({})).toThrow(ConnectorSdkError);
  });

  it("loads defaults", () => {
    const config = loadOneDriveConfig({
      [ONEDRIVE_ACCESS_TOKEN_ENV]: "token",
    });
    expect(config.requestTimeoutMs).toBe(30_000);
    expect(config.maxContentBytes).toBe(262_144);
    expect(config.allowedDriveIds).toBeUndefined();
    expect(config.writeEnabled).toBe(false);
  });

  it("tri-state drive allowlist: empty string deny all", () => {
    const config = loadOneDriveConfig({
      [ONEDRIVE_ACCESS_TOKEN_ENV]: "token",
      [ONEDRIVE_ALLOWED_DRIVE_IDS_ENV]: "",
    });
    expect(config.allowedDriveIds).toEqual([]);
  });

  it("tri-state root allowlist: undefined unrestricted", () => {
    const config = loadOneDriveConfig({
      [ONEDRIVE_ACCESS_TOKEN_ENV]: "token",
    });
    expect(config.allowedRootItemIds).toBeUndefined();
  });

  it("rejects empty upload folder allowlist when writes enabled", () => {
    expect(() =>
      loadOneDriveConfig({
        [ONEDRIVE_ACCESS_TOKEN_ENV]: "token",
        [ONEDRIVE_WRITE_ENABLED_ENV]: "true",
        [ONEDRIVE_HOST_WRITES_APPROVED_ENV]: "true",
        [ONEDRIVE_ALLOWED_UPLOAD_FOLDER_IDS_ENV]: "",
      }),
    ).toThrow(ConnectorSdkError);
  });

  it("parses upload folder allowlist when writes enabled", () => {
    const config = loadOneDriveConfig({
      [ONEDRIVE_ACCESS_TOKEN_ENV]: "token",
      [ONEDRIVE_WRITE_ENABLED_ENV]: "true",
      [ONEDRIVE_ALLOWED_UPLOAD_FOLDER_IDS_ENV]: "01FOLDER_A,01FOLDER_B",
    });
    expect(config.allowedUploadFolderIds).toEqual(["01FOLDER_A", "01FOLDER_B"]);
  });
});
