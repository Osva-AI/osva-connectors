import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { MAX_PARENT_WALK_DEPTH } from "./constants.js";
import { extractParentId, type NormalizedDriveItem } from "./normalize-item.js";
import type { OneDriveClient } from "./onedrive-client.js";

export interface DriveAllowlist {
  readonly allowedDriveIds: ReadonlySet<string>;
}

export interface RootItemAllowlist {
  readonly allowedRootItemIds: ReadonlySet<string>;
}

export function createDriveAllowlist(
  driveIds: readonly string[] | undefined,
): DriveAllowlist | undefined {
  if (driveIds === undefined) {
    return undefined;
  }
  return { allowedDriveIds: new Set(driveIds) };
}

export function createRootItemAllowlist(
  itemIds: readonly string[] | undefined,
): RootItemAllowlist | undefined {
  if (itemIds === undefined) {
    return undefined;
  }
  return { allowedRootItemIds: new Set(itemIds) };
}

export function assertDriveIdAllowed(
  allowlist: DriveAllowlist | undefined,
  driveId: string | undefined,
): void {
  if (allowlist === undefined) {
    return;
  }
  if (allowlist.allowedDriveIds.size === 0) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Drive allowlist is explicitly empty; no drives are permitted.",
    );
  }
  if (driveId === undefined || driveId.length === 0) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "OneDrive drive allowlist is configured; an allowed driveId is required.",
    );
  }
  if (!allowlist.allowedDriveIds.has(driveId)) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "The requested drive is not in the configured allowlist.",
    );
  }
}

export function assertDriveRecordAllowed(
  allowlist: DriveAllowlist | undefined,
  driveId: string | undefined,
): void {
  if (allowlist === undefined) {
    return;
  }
  if (allowlist.allowedDriveIds.size === 0) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Drive allowlist is explicitly empty; no drives are permitted.",
    );
  }
  if (driveId === undefined || driveId.length === 0) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "OneDrive drive allowlist is configured; items outside allowed drives cannot be accessed.",
    );
  }
  if (!allowlist.allowedDriveIds.has(driveId)) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "This item is not in a drive allowed by configuration.",
    );
  }
}

export function assertRootItemIdForList(
  allowlist: RootItemAllowlist | undefined,
  itemId: string | undefined,
): void {
  if (allowlist === undefined) {
    return;
  }
  if (allowlist.allowedRootItemIds.size === 0) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Root folder allowlist is explicitly empty; no folders may be listed.",
    );
  }
  if (itemId === undefined || itemId.length === 0) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Root folder allowlist is configured; onedrive.item.list requires itemId for an allowed folder.",
    );
  }
  if (!allowlist.allowedRootItemIds.has(itemId)) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "The requested folder is not in the configured root allowlist.",
    );
  }
}

export function assertUploadFolderAllowed(
  folderIds: readonly string[] | undefined,
  parentItemId: string,
): void {
  if (folderIds === undefined) {
    return;
  }
  if (folderIds.length === 0) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Upload folder allowlist is explicitly empty; uploads are not permitted.",
    );
  }
  if (!folderIds.includes(parentItemId)) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Upload parent folder is not in the configured upload allowlist.",
    );
  }
}

export async function assertItemUnderRootAllowlist(
  client: OneDriveClient,
  allowlist: RootItemAllowlist | undefined,
  itemId: string,
  driveId: string | undefined,
  signal: AbortSignal | undefined,
): Promise<void> {
  if (allowlist === undefined) {
    return;
  }
  if (allowlist.allowedRootItemIds.size === 0) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Root folder allowlist is explicitly empty; no items may be accessed.",
    );
  }
  if (allowlist.allowedRootItemIds.has(itemId)) {
    return;
  }

  let currentId = itemId;
  for (let depth = 0; depth < MAX_PARENT_WALK_DEPTH; depth += 1) {
    const raw = await client.getItem({
      itemId: currentId,
      ...(driveId !== undefined ? { driveId } : {}),
      signal,
    });
    const parentId = extractParentId(raw);
    if (parentId === undefined) {
      break;
    }
    if (allowlist.allowedRootItemIds.has(parentId)) {
      return;
    }
    if (allowlist.allowedRootItemIds.has(currentId)) {
      return;
    }
    currentId = parentId;
  }

  throw new ConnectorSdkError(
    "FORBIDDEN",
    "This item is not under a host-configured root folder.",
  );
}

export function filterItemsByRootAllowlistSync(
  allowlist: RootItemAllowlist | undefined,
  items: readonly NormalizedDriveItem[],
): NormalizedDriveItem[] {
  if (allowlist === undefined) {
    return [...items];
  }
  if (allowlist.allowedRootItemIds.size === 0) {
    return [];
  }
  return items.filter((item) => {
    if (allowlist.allowedRootItemIds.has(item.id)) {
      return true;
    }
    const parentId = item.parentId;
    if (parentId !== undefined && allowlist.allowedRootItemIds.has(parentId)) {
      return true;
    }
    return false;
  });
}
