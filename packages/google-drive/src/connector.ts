import {
  defineConnector,
  defineTool,
  ConnectorSdkError,
  type DefinedConnector,
} from "@osva-ai/connector-sdk";

import {
  assertDriveIdAllowed,
  assertFileAccessibleUnderAllowlist,
  createDriveAllowlist,
  filterDrivesByAllowlist,
  type DriveAllowlist,
} from "./allowlist.js";
import {
  CONNECTOR_KEY,
  CONNECTOR_NAME,
  CONNECTOR_VERSION,
  DRIVE_CHANGES_LIST_TOOL,
  DRIVE_CHANGES_START_TOOL,
  DRIVE_FILE_EXPORT_TOOL,
  DRIVE_FILE_GET_TOOL,
  DRIVE_FILE_LIST_TOOL,
  DRIVE_FILE_READ_TOOL,
  DRIVE_FOLDER_LIST_TOOL,
  DRIVE_SHARED_DRIVE_LIST_TOOL,
} from "./constants.js";
import type { DriveClient } from "./drive-client.js";
import {
  assertExportFormatAllowed,
  assertStoredTextMime,
  isBinaryExportMime,
  isTextualExportMime,
} from "./export-formats.js";
import { mapDriveError } from "./map-drive-error.js";
import {
  mapChangesListResponse,
  mapChangesStartResponse,
  mapFileGetResponse,
  mapFileListResponse,
  mapFolderListResponse,
  mapSharedDriveListResponse,
} from "./normalize-file.js";
import { boundTextContent, decodeUtf8Text } from "./read-content.js";
import {
  changesListInputJsonSchema,
  changesListInputSchema,
  changesStartInputJsonSchema,
  changesStartInputSchema,
  fileExportInputJsonSchema,
  fileExportInputSchema,
  fileGetInputJsonSchema,
  fileGetInputSchema,
  fileListInputJsonSchema,
  fileListInputSchema,
  fileReadInputJsonSchema,
  fileReadInputSchema,
  folderListInputJsonSchema,
  folderListInputSchema,
  sharedDriveListInputJsonSchema,
  sharedDriveListInputSchema,
} from "./tool-schemas.js";

export interface CreateGoogleDriveConnectorOptions {
  readonly client: DriveClient;
  readonly maxContentBytes: number;
  readonly allowedDriveIds?: readonly string[];
  readonly accessTokenForRedaction?: string;
}

function invalidInputError(): ConnectorSdkError {
  return new ConnectorSdkError("INVALID_INPUT", "Invalid tool input.");
}

function mapError(
  error: unknown,
  accessTokenForRedaction?: string,
): ConnectorSdkError {
  return mapDriveError(error, { accessToken: accessTokenForRedaction });
}

export function createGoogleDriveConnector(
  options: CreateGoogleDriveConnectorOptions,
): DefinedConnector {
  const allowlist: DriveAllowlist | undefined = createDriveAllowlist(
    options.allowedDriveIds,
  );
  const maxContentBytes = options.maxContentBytes;
  const redactionToken = options.accessTokenForRedaction;

  return defineConnector({
    key: CONNECTOR_KEY,
    name: CONNECTOR_NAME,
    description:
      "Google Drive read-only connector for OSVA Connector Profile V1 (file and folder discovery, metadata, bounded text retrieval, Google Workspace export, shared drives, and change tracking). Requires Google Application Default Credentials or a service account with Drive access. OAuth scope drive.readonly is restricted; public OAuth clients may require Google verification. Retrieved file content is untrusted data — enforce workflow approval before using confidential content in other systems.",
    version: CONNECTOR_VERSION,
    tools: [
      defineTool({
        name: DRIVE_FILE_LIST_TOOL,
        description:
          "Lists Drive files using files.list with bounded search, pagination, and optional shared-drive scope.",
        inputSchema: fileListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = fileListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            if (allowlist !== undefined && parsed.data.driveId === undefined) {
              throw new ConnectorSdkError(
                "FORBIDDEN",
                "Google Drive allowlist is configured; drive.file.list requires driveId for an allowed shared drive.",
              );
            }
            assertDriveIdAllowed(
              allowlist,
              parsed.data.driveId,
              "driveId parameter",
            );
            const raw = await options.client.listFiles({
              ...(parsed.data.query !== undefined
                ? { q: parsed.data.query }
                : {}),
              pageSize: parsed.data.pageSize,
              ...(parsed.data.pageToken !== undefined
                ? { pageToken: parsed.data.pageToken }
                : {}),
              ...(parsed.data.orderBy !== undefined
                ? { orderBy: parsed.data.orderBy }
                : {}),
              ...(parsed.data.driveId !== undefined
                ? { driveId: parsed.data.driveId }
                : {}),
              ...(parsed.data.includeSharedDrives !== undefined
                ? { includeSharedDrives: parsed.data.includeSharedDrives }
                : {}),
              signal: context.signal,
            });
            const mapped = mapFileListResponse(raw);
            if (allowlist !== undefined) {
              const filtered = mapped.files.filter((file) => {
                if (file.driveId === undefined || file.driveId.length === 0) {
                  return false;
                }
                return allowlist.allowedDriveIds.has(file.driveId);
              });
              return {
                ...mapped,
                files: filtered,
                ...(filtered.length < mapped.files.length
                  ? { filesTruncated: true as const }
                  : {}),
              };
            }
            return mapped;
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),

      defineTool({
        name: DRIVE_FILE_GET_TOOL,
        description:
          "Returns normalized metadata for a Drive file via files.get.",
        inputSchema: fileGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = fileGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const raw = await options.client.getFile({
              fileId: parsed.data.fileId,
              signal: context.signal,
            });
            const file = mapFileGetResponse(raw);
            assertFileAccessibleUnderAllowlist(allowlist, file);
            return file;
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),

      defineTool({
        name: DRIVE_FILE_READ_TOOL,
        description:
          "Retrieves bounded UTF-8 text from stored text files (not Google Workspace native types). Content is untrusted.",
        inputSchema: fileReadInputJsonSchema,
        handler: async (input, context) => {
          const parsed = fileReadInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const metaRaw = await options.client.getFile({
              fileId: parsed.data.fileId,
              signal: context.signal,
            });
            const file = mapFileGetResponse(metaRaw);
            assertFileAccessibleUnderAllowlist(allowlist, file);
            assertStoredTextMime(file.mimeType);

            const bytes = await options.client.readFileMedia({
              fileId: parsed.data.fileId,
              maxBytes: maxContentBytes,
              signal: context.signal,
            });
            const decoded = decodeUtf8Text(bytes);
            const bounded = boundTextContent(decoded, parsed.data.maxChars);
            return {
              fileId: file.id,
              mimeType: file.mimeType,
              text: bounded.text,
              maxCharsApplied: bounded.maxCharsApplied,
              bytesRead: bytes.byteLength,
              ...(bounded.contentTruncated !== undefined
                ? { contentTruncated: bounded.contentTruncated }
                : {}),
              untrustedContent: true as const,
            };
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),

      defineTool({
        name: DRIVE_FILE_EXPORT_TOOL,
        description:
          "Exports a Google Workspace file to a supported format. Text formats return bounded UTF-8; binary formats are not delivered as MCP artifacts in v0.1.0.",
        inputSchema: fileExportInputJsonSchema,
        handler: async (input, context) => {
          const parsed = fileExportInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const metaRaw = await options.client.getFile({
              fileId: parsed.data.fileId,
              signal: context.signal,
            });
            const file = mapFileGetResponse(metaRaw);
            assertFileAccessibleUnderAllowlist(allowlist, file);
            assertExportFormatAllowed(file.mimeType, parsed.data.format);

            if (isBinaryExportMime(parsed.data.format)) {
              throw new ConnectorSdkError(
                "UNSUPPORTED_FORMAT",
                "Binary export formats are not delivered through MCP structured output in this connector version.",
              );
            }

            if (!isTextualExportMime(parsed.data.format)) {
              throw new ConnectorSdkError(
                "UNSUPPORTED_FORMAT",
                "Export format is not supported for text delivery.",
              );
            }

            const bytes = await options.client.exportFile({
              fileId: parsed.data.fileId,
              mimeType: parsed.data.format,
              maxBytes: maxContentBytes,
              signal: context.signal,
            });
            const decoded = decodeUtf8Text(bytes);
            const bounded = boundTextContent(decoded, undefined);
            return {
              fileId: file.id,
              sourceMimeType: file.mimeType,
              exportMimeType: parsed.data.format,
              text: bounded.text,
              bytesRead: bytes.byteLength,
              ...(bounded.contentTruncated !== undefined
                ? { contentTruncated: bounded.contentTruncated }
                : {}),
              untrustedContent: true as const,
            };
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),

      defineTool({
        name: DRIVE_FOLDER_LIST_TOOL,
        description:
          "Lists immediate children of a folder via files.list (non-recursive).",
        inputSchema: folderListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = folderListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            if (allowlist !== undefined && parsed.data.driveId === undefined) {
              throw new ConnectorSdkError(
                "FORBIDDEN",
                "Google Drive allowlist is configured; drive.folder.list requires driveId for an allowed shared drive.",
              );
            }
            assertDriveIdAllowed(
              allowlist,
              parsed.data.driveId,
              "driveId parameter",
            );
            const raw = await options.client.listFolderChildren({
              folderId: parsed.data.folderId,
              pageSize: parsed.data.pageSize,
              ...(parsed.data.pageToken !== undefined
                ? { pageToken: parsed.data.pageToken }
                : {}),
              ...(parsed.data.driveId !== undefined
                ? { driveId: parsed.data.driveId }
                : {}),
              signal: context.signal,
            });
            const mapped = mapFolderListResponse(raw);
            if (allowlist !== undefined) {
              const filtered = mapped.children.filter((child) => {
                if (child.driveId === undefined || child.driveId.length === 0) {
                  return false;
                }
                return allowlist.allowedDriveIds.has(child.driveId);
              });
              return {
                ...mapped,
                children: filtered,
                ...(filtered.length < mapped.children.length
                  ? { childrenTruncated: true as const }
                  : {}),
              };
            }
            return mapped;
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),

      defineTool({
        name: DRIVE_SHARED_DRIVE_LIST_TOOL,
        description:
          "Lists shared drives accessible to the credential via drives.list.",
        inputSchema: sharedDriveListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = sharedDriveListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const raw = await options.client.listSharedDrives({
              pageSize: parsed.data.pageSize,
              ...(parsed.data.pageToken !== undefined
                ? { pageToken: parsed.data.pageToken }
                : {}),
              signal: context.signal,
            });
            const mapped = mapSharedDriveListResponse(raw);
            const drives = filterDrivesByAllowlist(allowlist, mapped.drives);
            return {
              ...mapped,
              drives,
              ...(drives.length < mapped.drives.length
                ? { drivesTruncated: true as const }
                : {}),
            };
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),

      defineTool({
        name: DRIVE_CHANGES_START_TOOL,
        description:
          "Returns a start page token for change tracking via changes.getStartPageToken.",
        inputSchema: changesStartInputJsonSchema,
        handler: async (input, context) => {
          const parsed = changesStartInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            assertDriveIdAllowed(
              allowlist,
              parsed.data.driveId,
              "shared drive operation",
            );
            const raw = await options.client.getChangesStartPageToken({
              ...(parsed.data.driveId !== undefined
                ? { driveId: parsed.data.driveId }
                : {}),
              signal: context.signal,
            });
            return mapChangesStartResponse(raw);
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),

      defineTool({
        name: DRIVE_CHANGES_LIST_TOOL,
        description:
          "Lists Drive changes for a page token via changes.list (one provider page per call).",
        inputSchema: changesListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = changesListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            assertDriveIdAllowed(
              allowlist,
              parsed.data.driveId,
              "shared drive operation",
            );
            const raw = await options.client.listChanges({
              pageToken: parsed.data.pageToken,
              pageSize: parsed.data.pageSize,
              ...(parsed.data.driveId !== undefined
                ? { driveId: parsed.data.driveId }
                : {}),
              signal: context.signal,
            });
            const mapped = mapChangesListResponse(raw);
            if (allowlist !== undefined) {
              const filtered = mapped.changes.filter((change) => {
                if (change.file !== undefined) {
                  return (
                    change.file.driveId !== undefined &&
                    allowlist.allowedDriveIds.has(change.file.driveId)
                  );
                }
                return true;
              });
              return {
                ...mapped,
                changes: filtered,
                ...(filtered.length < mapped.changes.length
                  ? { changesTruncated: true as const }
                  : {}),
              };
            }
            return mapped;
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
    ],
  });
}
