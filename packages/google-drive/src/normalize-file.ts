import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { OUTPUT_MAX_PROVIDER_STRING_LENGTH } from "./constants.js";
import {
  assertStructuredOutputWithinBudget,
  normalizeEssentialProviderString,
  normalizeTruncatableProviderString,
  packListWithinOutputBudget,
} from "./output-budget.js";

export interface NormalizedDriveFile {
  readonly id: string;
  readonly name: string;
  readonly mimeType: string;
  readonly description?: string;
  readonly descriptionTruncated?: true;
  readonly size?: string;
  readonly createdTime?: string;
  readonly modifiedTime?: string;
  readonly parents?: string[];
  readonly webViewLink?: string;
  readonly driveId?: string;
  readonly trashed?: boolean;
}

export interface NormalizedSharedDrive {
  readonly id: string;
  readonly name: string;
  readonly hidden?: boolean;
  readonly restrictions?: {
    readonly adminManagedRestrictions?: boolean;
    readonly copyRequiresWriterPermission?: boolean;
    readonly domainUsersOnly?: boolean;
    readonly driveMembersOnly?: boolean;
  };
}

export interface NormalizedDriveChange {
  readonly fileId?: string;
  readonly removed?: boolean;
  readonly time?: string;
  readonly file?: NormalizedDriveFile;
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Google Drive returned an unexpected payload.",
    );
  }
  return value;
}

function normalizeParents(value: unknown): string[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Google Drive returned an unexpected payload.",
    );
  }
  const parents: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Google Drive returned an unexpected payload.",
      );
    }
    parents.push(
      normalizeEssentialProviderString(
        entry,
        OUTPUT_MAX_PROVIDER_STRING_LENGTH,
      ),
    );
  }
  return parents.length > 0 ? parents : undefined;
}

export function normalizeDriveFile(raw: unknown): NormalizedDriveFile {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Google Drive returned an unexpected payload.",
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
  const mimeType = normalizeEssentialProviderString(
    record.mimeType,
    OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  );

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

  const sizeRaw = normalizeOptionalString(record.size);
  const size =
    sizeRaw !== undefined
      ? normalizeEssentialProviderString(
          sizeRaw,
          OUTPUT_MAX_PROVIDER_STRING_LENGTH,
        )
      : undefined;

  const createdTime = normalizeOptionalString(record.createdTime);
  const modifiedTime = normalizeOptionalString(record.modifiedTime);
  const webViewLink = normalizeOptionalString(record.webViewLink);
  const driveId = normalizeOptionalString(record.driveId);
  const trashed =
    typeof record.trashed === "boolean" ? record.trashed : undefined;

  const file: NormalizedDriveFile = {
    id,
    name,
    mimeType,
    ...(description !== undefined ? { description } : {}),
    ...(descriptionTruncated !== undefined ? { descriptionTruncated } : {}),
    ...(size !== undefined ? { size } : {}),
    ...(createdTime !== undefined ? { createdTime } : {}),
    ...(modifiedTime !== undefined ? { modifiedTime } : {}),
    ...(normalizeParents(record.parents) !== undefined
      ? { parents: normalizeParents(record.parents) }
      : {}),
    ...(webViewLink !== undefined ? { webViewLink } : {}),
    ...(driveId !== undefined ? { driveId } : {}),
    ...(trashed !== undefined ? { trashed } : {}),
  };
  return file;
}

export function mapFileListResponse(raw: unknown): {
  files: NormalizedDriveFile[];
  nextPageToken?: string;
  incompleteSearch?: boolean;
  filesTruncated?: true;
} {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Google Drive returned an unexpected payload.",
    );
  }
  const record = raw as Record<string, unknown>;
  const filesRaw = record.files;
  const files: NormalizedDriveFile[] = [];
  if (Array.isArray(filesRaw)) {
    for (const entry of filesRaw) {
      files.push(normalizeDriveFile(entry));
    }
  }

  const nextPageToken =
    record.nextPageToken !== undefined && record.nextPageToken !== null
      ? normalizeEssentialProviderString(
          record.nextPageToken,
          OUTPUT_MAX_PROVIDER_STRING_LENGTH,
        )
      : undefined;

  const incompleteSearch =
    typeof record.incompleteSearch === "boolean"
      ? record.incompleteSearch
      : undefined;

  const packed = packListWithinOutputBudget(
    {
      ...(nextPageToken !== undefined ? { nextPageToken } : {}),
      ...(incompleteSearch !== undefined ? { incompleteSearch } : {}),
    },
    "files",
    files,
  );

  assertStructuredOutputWithinBudget(packed);
  return packed;
}

export function mapFileGetResponse(raw: unknown): NormalizedDriveFile {
  const file = normalizeDriveFile(raw);
  assertStructuredOutputWithinBudget(file);
  return file;
}

export function mapSharedDriveListResponse(raw: unknown): {
  drives: NormalizedSharedDrive[];
  nextPageToken?: string;
  drivesTruncated?: true;
} {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Google Drive returned an unexpected payload.",
    );
  }
  const record = raw as Record<string, unknown>;
  const drivesRaw = record.drives;
  const drives: NormalizedSharedDrive[] = [];
  if (Array.isArray(drivesRaw)) {
    for (const entry of drivesRaw) {
      if (entry === null || typeof entry !== "object") {
        continue;
      }
      const d = entry as Record<string, unknown>;
      const id = normalizeEssentialProviderString(
        d.id,
        OUTPUT_MAX_PROVIDER_STRING_LENGTH,
      );
      const name = normalizeEssentialProviderString(
        d.name,
        OUTPUT_MAX_PROVIDER_STRING_LENGTH,
      );
      const hidden = typeof d.hidden === "boolean" ? d.hidden : undefined;
      let restrictions: NormalizedSharedDrive["restrictions"];
      if (d.restrictions !== null && typeof d.restrictions === "object") {
        const r = d.restrictions as Record<string, unknown>;
        restrictions = {
          ...(typeof r.adminManagedRestrictions === "boolean"
            ? { adminManagedRestrictions: r.adminManagedRestrictions }
            : {}),
          ...(typeof r.copyRequiresWriterPermission === "boolean"
            ? { copyRequiresWriterPermission: r.copyRequiresWriterPermission }
            : {}),
          ...(typeof r.domainUsersOnly === "boolean"
            ? { domainUsersOnly: r.domainUsersOnly }
            : {}),
          ...(typeof r.driveMembersOnly === "boolean"
            ? { driveMembersOnly: r.driveMembersOnly }
            : {}),
        };
      }
      drives.push({
        id,
        name,
        ...(hidden !== undefined ? { hidden } : {}),
        ...(restrictions !== undefined && Object.keys(restrictions).length > 0
          ? { restrictions }
          : {}),
      });
    }
  }

  const nextPageToken =
    record.nextPageToken !== undefined && record.nextPageToken !== null
      ? normalizeEssentialProviderString(
          record.nextPageToken,
          OUTPUT_MAX_PROVIDER_STRING_LENGTH,
        )
      : undefined;

  const packed = packListWithinOutputBudget(
    { ...(nextPageToken !== undefined ? { nextPageToken } : {}) },
    "drives",
    drives,
  );
  assertStructuredOutputWithinBudget(packed);
  return packed;
}

export function mapChangesStartResponse(raw: unknown): {
  startPageToken: string;
  scope?: string;
} {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Google Drive returned an unexpected payload.",
    );
  }
  const record = raw as Record<string, unknown>;
  const startPageToken = normalizeEssentialProviderString(
    record.startPageToken,
    OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  );
  const scope =
    record.scope !== undefined && record.scope !== null
      ? normalizeEssentialProviderString(
          record.scope,
          OUTPUT_MAX_PROVIDER_STRING_LENGTH,
        )
      : undefined;
  const result = {
    startPageToken,
    ...(scope !== undefined ? { scope } : {}),
  };
  assertStructuredOutputWithinBudget(result);
  return result;
}

export function mapChangesListResponse(raw: unknown): {
  changes: NormalizedDriveChange[];
  nextPageToken?: string;
  newStartPageToken?: string;
  changesTruncated?: true;
} {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Google Drive returned an unexpected payload.",
    );
  }
  const record = raw as Record<string, unknown>;
  const changesRaw = record.changes;
  const changes: NormalizedDriveChange[] = [];
  if (Array.isArray(changesRaw)) {
    for (const entry of changesRaw) {
      if (entry === null || typeof entry !== "object") {
        continue;
      }
      const c = entry as Record<string, unknown>;
      const fileId =
        c.fileId !== undefined && c.fileId !== null
          ? normalizeEssentialProviderString(
              c.fileId,
              OUTPUT_MAX_PROVIDER_STRING_LENGTH,
            )
          : undefined;
      const removed = typeof c.removed === "boolean" ? c.removed : undefined;
      const time =
        c.time !== undefined && c.time !== null
          ? normalizeEssentialProviderString(
              c.time,
              OUTPUT_MAX_PROVIDER_STRING_LENGTH,
            )
          : undefined;
      let file: NormalizedDriveFile | undefined;
      if (c.file !== undefined && c.file !== null && c.removed !== true) {
        file = normalizeDriveFile(c.file);
      }
      changes.push({
        ...(fileId !== undefined ? { fileId } : {}),
        ...(removed !== undefined ? { removed } : {}),
        ...(time !== undefined ? { time } : {}),
        ...(file !== undefined ? { file } : {}),
      });
    }
  }

  const nextPageToken =
    record.nextPageToken !== undefined && record.nextPageToken !== null
      ? normalizeEssentialProviderString(
          record.nextPageToken,
          OUTPUT_MAX_PROVIDER_STRING_LENGTH,
        )
      : undefined;
  const newStartPageToken =
    record.newStartPageToken !== undefined && record.newStartPageToken !== null
      ? normalizeEssentialProviderString(
          record.newStartPageToken,
          OUTPUT_MAX_PROVIDER_STRING_LENGTH,
        )
      : undefined;

  const packed = packListWithinOutputBudget(
    {
      ...(nextPageToken !== undefined ? { nextPageToken } : {}),
      ...(newStartPageToken !== undefined ? { newStartPageToken } : {}),
    },
    "changes",
    changes,
  );
  assertStructuredOutputWithinBudget(packed);
  return packed;
}

export function mapFolderListResponse(raw: unknown): {
  children: NormalizedDriveFile[];
  nextPageToken?: string;
  childrenTruncated?: true;
} {
  const listed = mapFileListResponse(raw);
  return {
    children: listed.files,
    ...(listed.nextPageToken !== undefined
      ? { nextPageToken: listed.nextPageToken }
      : {}),
    ...(listed.filesTruncated !== undefined
      ? { childrenTruncated: listed.filesTruncated }
      : {}),
  };
}
