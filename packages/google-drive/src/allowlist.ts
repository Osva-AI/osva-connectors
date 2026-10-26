import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import type { NormalizedDriveFile } from "./normalize-file.js";

export interface DriveAllowlist {
  readonly allowedDriveIds: ReadonlySet<string>;
}

export function createDriveAllowlist(
  driveIds: readonly string[] | undefined,
): DriveAllowlist | undefined {
  if (driveIds === undefined || driveIds.length === 0) {
    return undefined;
  }
  return { allowedDriveIds: new Set(driveIds) };
}

export function assertDriveIdAllowed(
  allowlist: DriveAllowlist | undefined,
  driveId: string | undefined,
  context: "driveId parameter" | "shared drive operation",
): void {
  if (allowlist === undefined) {
    return;
  }
  if (driveId === undefined || driveId.length === 0) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      `Google Drive allowlist is configured; ${context} requires an allowed shared drive.`,
    );
  }
  if (!allowlist.allowedDriveIds.has(driveId)) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "The requested shared drive is not in the configured allowlist.",
    );
  }
}

export function assertFileAccessibleUnderAllowlist(
  allowlist: DriveAllowlist | undefined,
  file: Pick<NormalizedDriveFile, "driveId">,
): void {
  if (allowlist === undefined) {
    return;
  }
  const driveId = file.driveId;
  if (driveId === undefined || driveId.length === 0) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Google Drive allowlist is configured; files outside allowed shared drives cannot be accessed.",
    );
  }
  if (!allowlist.allowedDriveIds.has(driveId)) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "This file is not in a shared drive allowed by configuration.",
    );
  }
}

export function filterDrivesByAllowlist<T extends { id: string }>(
  allowlist: DriveAllowlist | undefined,
  drives: readonly T[],
): T[] {
  if (allowlist === undefined) {
    return [...drives];
  }
  return drives.filter((drive) => allowlist.allowedDriveIds.has(drive.id));
}
