import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { OUTPUT_MAX_PROVIDER_STRING_LENGTH } from "./constants.js";
import {
  assertStructuredOutputWithinBudget,
  normalizeEssentialProviderString,
  normalizeTruncatableProviderString,
  packListWithinOutputBudget,
} from "./output-budget.js";

export interface NormalizedDrive {
  readonly id: string;
  readonly name?: string;
  readonly driveType?: string;
  readonly ownerDisplayName?: string;
}

export interface NormalizedDriveItem {
  readonly id: string;
  readonly name: string;
  readonly mimeType?: string;
  readonly size?: number;
  readonly createdDateTime?: string;
  readonly lastModifiedDateTime?: string;
  readonly webUrl?: string;
  readonly parentId?: string;
  readonly driveId?: string;
  readonly folderChildCount?: number;
  readonly fileMimeType?: string;
  readonly description?: string;
  readonly descriptionTruncated?: true;
}

export function extractParentId(raw: unknown): string | undefined {
  if (raw === null || typeof raw !== "object") {
    return undefined;
  }
  const record = raw as Record<string, unknown>;
  const parentRef = record.parentReference;
  if (parentRef === null || typeof parentRef !== "object") {
    return undefined;
  }
  const id = (parentRef as Record<string, unknown>).id;
  return typeof id === "string" ? id : undefined;
}

export function extractDriveId(raw: unknown): string | undefined {
  if (raw === null || typeof raw !== "object") {
    return undefined;
  }
  const record = raw as Record<string, unknown>;
  const parentRef = record.parentReference;
  if (parentRef !== null && typeof parentRef === "object") {
    const driveId = (parentRef as Record<string, unknown>).driveId;
    if (typeof driveId === "string") {
      return driveId;
    }
  }
  const parent = record.parent;
  if (parent !== null && typeof parent === "object") {
    const id = (parent as Record<string, unknown>).id;
    if (typeof id === "string") {
      return id;
    }
  }
  return undefined;
}

export function normalizeDriveItem(raw: unknown): NormalizedDriveItem {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "OneDrive returned an unexpected payload.",
    );
  }
  const record = raw as Record<string, unknown>;
  const id = normalizeEssentialProviderString(
    record.id,
    OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  );
  const name = normalizeEssentialProviderString(
    record.name,
    OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  );

  const mimeType =
    record.folder !== undefined && record.folder !== null
      ? "application/vnd.onedrive.folder"
      : typeof (record.file as Record<string, unknown> | undefined)
            ?.mimeType === "string"
        ? normalizeEssentialProviderString(
            (record.file as Record<string, unknown>).mimeType,
            OUTPUT_MAX_PROVIDER_STRING_LENGTH,
          )
        : undefined;

  const size =
    typeof record.size === "number" && Number.isFinite(record.size)
      ? record.size
      : undefined;

  const createdDateTime =
    typeof record.createdDateTime === "string"
      ? record.createdDateTime
      : undefined;
  const lastModifiedDateTime =
    typeof record.lastModifiedDateTime === "string"
      ? record.lastModifiedDateTime
      : undefined;
  const webUrl = typeof record.webUrl === "string" ? record.webUrl : undefined;

  const parentId = extractParentId(record);
  const driveId = extractDriveId(record);

  let folderChildCount: number | undefined;
  if (record.folder !== null && typeof record.folder === "object") {
    const count = (record.folder as Record<string, unknown>).childCount;
    if (typeof count === "number" && Number.isFinite(count)) {
      folderChildCount = count;
    }
  }

  let description: string | undefined;
  let descriptionTruncated: true | undefined;
  if (record.description !== undefined && record.description !== null) {
    const normalized = normalizeTruncatableProviderString(
      record.description,
      OUTPUT_MAX_PROVIDER_STRING_LENGTH,
    );
    description = normalized.value;
    descriptionTruncated = normalized.truncated ? true : undefined;
  }

  const item: NormalizedDriveItem = {
    id,
    name,
    ...(mimeType !== undefined ? { mimeType } : {}),
    ...(size !== undefined ? { size } : {}),
    ...(createdDateTime !== undefined ? { createdDateTime } : {}),
    ...(lastModifiedDateTime !== undefined ? { lastModifiedDateTime } : {}),
    ...(webUrl !== undefined ? { webUrl } : {}),
    ...(parentId !== undefined ? { parentId } : {}),
    ...(driveId !== undefined ? { driveId } : {}),
    ...(folderChildCount !== undefined ? { folderChildCount } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(descriptionTruncated !== undefined ? { descriptionTruncated } : {}),
  };
  return item;
}

export function mapItemGetResponse(raw: unknown): NormalizedDriveItem {
  const item = normalizeDriveItem(raw);
  assertStructuredOutputWithinBudget(item);
  return item;
}

export function mapDriveGetResponse(raw: unknown): NormalizedDrive {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "OneDrive returned an unexpected payload.",
    );
  }
  const record = raw as Record<string, unknown>;
  const id = normalizeEssentialProviderString(
    record.id,
    OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  );
  const name =
    record.name !== undefined && record.name !== null
      ? normalizeEssentialProviderString(
          record.name,
          OUTPUT_MAX_PROVIDER_STRING_LENGTH,
        )
      : undefined;
  const driveType =
    typeof record.driveType === "string" ? record.driveType : undefined;
  let ownerDisplayName: string | undefined;
  if (record.owner !== null && typeof record.owner === "object") {
    const user = (record.owner as Record<string, unknown>).user;
    if (user !== null && typeof user === "object") {
      const displayName = (user as Record<string, unknown>).displayName;
      if (typeof displayName === "string") {
        ownerDisplayName = displayName;
      }
    }
  }
  const drive: NormalizedDrive = {
    id,
    ...(name !== undefined ? { name } : {}),
    ...(driveType !== undefined ? { driveType } : {}),
    ...(ownerDisplayName !== undefined ? { ownerDisplayName } : {}),
  };
  assertStructuredOutputWithinBudget(drive);
  return drive;
}

export function mapItemListResponse(raw: unknown): {
  items: NormalizedDriveItem[];
  nextLink?: string;
  itemsTruncated?: true;
} {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "OneDrive returned an unexpected payload.",
    );
  }
  const record = raw as Record<string, unknown>;
  const valueRaw = record.value;
  const items: NormalizedDriveItem[] = [];
  if (Array.isArray(valueRaw)) {
    for (const entry of valueRaw) {
      items.push(normalizeDriveItem(entry));
    }
  }

  const nextLink =
    record["@odata.nextLink"] !== undefined &&
    record["@odata.nextLink"] !== null
      ? normalizeEssentialProviderString(
          record["@odata.nextLink"],
          OUTPUT_MAX_PROVIDER_STRING_LENGTH,
        )
      : undefined;

  const packed = packListWithinOutputBudget(
    { ...(nextLink !== undefined ? { nextLink } : {}) },
    "items",
    items,
  );
  assertStructuredOutputWithinBudget(packed);
  return packed;
}

export function mapSearchResponse(raw: unknown): {
  items: NormalizedDriveItem[];
  nextLink?: string;
  itemsTruncated?: true;
} {
  return mapItemListResponse(raw);
}

export function mapUploadResponse(raw: unknown): NormalizedDriveItem {
  return mapItemGetResponse(raw);
}
