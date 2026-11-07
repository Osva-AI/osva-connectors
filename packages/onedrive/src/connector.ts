import {
  defineConnector,
  defineTool,
  ConnectorSdkError,
  type DefinedConnector,
} from "@osva-ai/connector-sdk";

import {
  assertDriveIdAllowed,
  assertDriveRecordAllowed,
  assertItemUnderRootAllowlist,
  assertRootItemIdForList,
  assertUploadFolderAllowed,
  createDriveAllowlist,
  createRootItemAllowlist,
  filterItemsByRootAllowlistSync,
  type DriveAllowlist,
  type RootItemAllowlist,
} from "./allowlist.js";
import {
  CONNECTOR_KEY,
  CONNECTOR_NAME,
  CONNECTOR_VERSION,
  ONEDRIVE_DRIVE_GET_TOOL,
  ONEDRIVE_FILE_READ_TOOL,
  ONEDRIVE_FILE_SEARCH_TOOL,
  ONEDRIVE_FILE_UPLOAD_SMALL_TOOL,
  ONEDRIVE_ITEM_GET_TOOL,
  ONEDRIVE_ITEM_LIST_TOOL,
  GRAPH_API_HOST,
} from "./constants.js";
import { mapOneDriveError } from "./map-onedrive-error.js";
import {
  mapDriveGetResponse,
  mapItemGetResponse,
  mapItemListResponse,
  mapSearchResponse,
  mapUploadResponse,
} from "./normalize-item.js";
import type { OneDriveClient } from "./onedrive-client.js";
import {
  ONEDRIVE_NEXT_LINK_SCOPES,
  validateGraphNextLink,
} from "./onedrive-ids.js";
import {
  boundTextContent,
  decodeUtf8Text,
  isDeliverableTextMime,
} from "./read-content.js";
import type { OneDriveConfig } from "./schemas.js";
import {
  driveGetInputJsonSchema,
  driveGetInputSchema,
  fileReadInputJsonSchema,
  fileReadInputSchema,
  fileSearchInputJsonSchema,
  fileSearchInputSchema,
  fileUploadSmallInputJsonSchema,
  fileUploadSmallInputSchema,
  itemGetInputJsonSchema,
  itemGetInputSchema,
  itemListInputJsonSchema,
  itemListInputSchema,
} from "./tool-schemas.js";

export interface CreateOneDriveConnectorOptions {
  readonly client: OneDriveClient;
  readonly config: OneDriveConfig;
  readonly graphApiHost?: string;
  readonly accessTokenForRedaction?: string;
}

function invalidInputError(): ConnectorSdkError {
  return new ConnectorSdkError("INVALID_INPUT", "Invalid tool input.");
}

function mapError(
  error: unknown,
  accessTokenForRedaction?: string,
): ConnectorSdkError {
  return mapOneDriveError(error, { accessToken: accessTokenForRedaction });
}

function assertWritesAllowed(config: OneDriveConfig): void {
  if (!config.writeEnabled) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "OneDrive writes are disabled. Set OSVA_CONNECTOR_ONEDRIVE_WRITE_ENABLED=true to allow uploads.",
    );
  }
  if (!config.hostWritesApproved) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "OneDrive writes require host approval. Set OSVA_CONNECTOR_ONEDRIVE_HOST_WRITES_APPROVED=true.",
    );
  }
}

function decodeUploadContent(
  contentBase64: string,
  maxBytes: number,
): Uint8Array {
  let buf: Buffer;
  try {
    buf = Buffer.from(contentBase64.trim(), "base64");
  } catch {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Upload content is not valid base64.",
    );
  }
  if (buf.byteLength === 0) {
    throw new ConnectorSdkError("INVALID_INPUT", "Upload content is empty.");
  }
  if (buf.byteLength > maxBytes) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Upload content exceeds the connector small-upload size limit.",
    );
  }
  return new Uint8Array(buf);
}

export function createOneDriveConnector(
  options: CreateOneDriveConnectorOptions,
): DefinedConnector {
  const config = options.config;
  const driveAllowlist: DriveAllowlist | undefined = createDriveAllowlist(
    config.allowedDriveIds,
  );
  const rootAllowlist: RootItemAllowlist | undefined = createRootItemAllowlist(
    config.allowedRootItemIds,
  );
  const graphApiHost = options.graphApiHost ?? GRAPH_API_HOST;
  const redactionToken = options.accessTokenForRedaction;

  return defineConnector({
    key: CONNECTOR_KEY,
    name: CONNECTOR_NAME,
    version: CONNECTOR_VERSION,
    description:
      "Microsoft OneDrive MCP connector for OSVA Connector Profile V1 (delegated Graph v1): bounded drive and item reads, UTF-8 text retrieval, search, and optional small-file upload when explicitly enabled and host-approved. File text is untrusted external content.",
    tools: [
      defineTool({
        name: ONEDRIVE_DRIVE_GET_TOOL,
        description:
          "Returns metadata for the signed-in user's default drive or a specific drive by id.",
        inputSchema: driveGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = driveGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            assertDriveIdAllowed(driveAllowlist, parsed.data.driveId);
            const raw = await options.client.getDrive({
              ...(parsed.data.driveId !== undefined
                ? { driveId: parsed.data.driveId }
                : {}),
              signal: context.signal,
            });
            const drive = mapDriveGetResponse(raw);
            assertDriveRecordAllowed(driveAllowlist, drive.id);
            return drive;
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),

      defineTool({
        name: ONEDRIVE_ITEM_LIST_TOOL,
        description:
          "Lists immediate children of a drive root folder or a folder item (one Graph page per call).",
        inputSchema: itemListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = itemListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const nextLink =
              parsed.data.nextLink !== undefined
                ? validateGraphNextLink(
                    parsed.data.nextLink,
                    graphApiHost,
                    ONEDRIVE_NEXT_LINK_SCOPES.driveChildren,
                  )
                : undefined;
            assertDriveIdAllowed(driveAllowlist, parsed.data.driveId);
            assertRootItemIdForList(rootAllowlist, parsed.data.itemId);
            const raw = await options.client.listChildren({
              ...(parsed.data.itemId !== undefined
                ? { itemId: parsed.data.itemId }
                : {}),
              ...(parsed.data.driveId !== undefined
                ? { driveId: parsed.data.driveId }
                : {}),
              pageSize: parsed.data.pageSize,
              ...(nextLink !== undefined ? { nextLink } : {}),
              signal: context.signal,
            });
            const mapped = mapItemListResponse(raw);
            const filtered = filterItemsByRootAllowlistSync(
              rootAllowlist,
              mapped.items,
            );
            return {
              ...mapped,
              items: filtered,
              ...(filtered.length < mapped.items.length
                ? { itemsTruncated: true as const }
                : {}),
            };
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),

      defineTool({
        name: ONEDRIVE_ITEM_GET_TOOL,
        description: "Returns normalized metadata for a drive item.",
        inputSchema: itemGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = itemGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            assertDriveIdAllowed(driveAllowlist, parsed.data.driveId);
            const raw = await options.client.getItem({
              itemId: parsed.data.itemId,
              ...(parsed.data.driveId !== undefined
                ? { driveId: parsed.data.driveId }
                : {}),
              signal: context.signal,
            });
            const item = mapItemGetResponse(raw);
            assertDriveRecordAllowed(driveAllowlist, item.driveId);
            await assertItemUnderRootAllowlist(
              options.client,
              rootAllowlist,
              item.id,
              parsed.data.driveId,
              context.signal,
            );
            return item;
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),

      defineTool({
        name: ONEDRIVE_FILE_READ_TOOL,
        description:
          "Retrieves bounded UTF-8 text from a file item. Binary files return metadata only. Content is untrusted.",
        inputSchema: fileReadInputJsonSchema,
        handler: async (input, context) => {
          const parsed = fileReadInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            assertDriveIdAllowed(driveAllowlist, parsed.data.driveId);
            const metaRaw = await options.client.getItem({
              itemId: parsed.data.itemId,
              ...(parsed.data.driveId !== undefined
                ? { driveId: parsed.data.driveId }
                : {}),
              signal: context.signal,
            });
            const item = mapItemGetResponse(metaRaw);
            assertDriveRecordAllowed(driveAllowlist, item.driveId);
            await assertItemUnderRootAllowlist(
              options.client,
              rootAllowlist,
              item.id,
              parsed.data.driveId,
              context.signal,
            );

            if (item.mimeType === "application/vnd.onedrive.folder") {
              throw new ConnectorSdkError(
                "UNSUPPORTED_FORMAT",
                "Folders do not have readable file content.",
              );
            }

            const mime = item.mimeType ?? "application/octet-stream";
            if (!isDeliverableTextMime(mime)) {
              return {
                itemId: item.id,
                mimeType: mime,
                binaryContentOmitted: true as const,
                ...(item.size !== undefined ? { size: item.size } : {}),
                untrustedContent: true as const,
              };
            }

            const bytes = await options.client.readItemContent({
              itemId: parsed.data.itemId,
              ...(parsed.data.driveId !== undefined
                ? { driveId: parsed.data.driveId }
                : {}),
              maxBytes: config.maxContentBytes,
              signal: context.signal,
            });
            const decoded = decodeUtf8Text(bytes);
            const bounded = boundTextContent(decoded, parsed.data.maxChars);
            return {
              itemId: item.id,
              mimeType: mime,
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
        name: ONEDRIVE_FILE_SEARCH_TOOL,
        description:
          "Searches under the drive root via Microsoft Graph search (one page per call).",
        inputSchema: fileSearchInputJsonSchema,
        handler: async (input, context) => {
          const parsed = fileSearchInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const nextLink =
              parsed.data.nextLink !== undefined
                ? validateGraphNextLink(
                    parsed.data.nextLink,
                    graphApiHost,
                    ONEDRIVE_NEXT_LINK_SCOPES.driveSearch,
                  )
                : undefined;
            assertDriveIdAllowed(driveAllowlist, parsed.data.driveId);
            const raw = await options.client.searchItems({
              query: parsed.data.query,
              ...(parsed.data.driveId !== undefined
                ? { driveId: parsed.data.driveId }
                : {}),
              pageSize: parsed.data.pageSize,
              ...(nextLink !== undefined ? { nextLink } : {}),
              signal: context.signal,
            });
            const mapped = mapSearchResponse(raw);
            const filtered = filterItemsByRootAllowlistSync(
              rootAllowlist,
              mapped.items,
            );
            return {
              ...mapped,
              items: filtered,
              ...(filtered.length < mapped.items.length
                ? { itemsTruncated: true as const }
                : {}),
            };
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),

      defineTool({
        name: ONEDRIVE_FILE_UPLOAD_SMALL_TOOL,
        description:
          "Uploads a small file with PUT content when writes are enabled and host-approved.",
        inputSchema: fileUploadSmallInputJsonSchema,
        handler: async (input, context) => {
          const parsed = fileUploadSmallInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            assertWritesAllowed(config);
            assertDriveIdAllowed(driveAllowlist, parsed.data.driveId);
            assertUploadFolderAllowed(
              config.allowedUploadFolderIds,
              parsed.data.parentItemId,
            );
            await assertItemUnderRootAllowlist(
              options.client,
              rootAllowlist,
              parsed.data.parentItemId,
              parsed.data.driveId,
              context.signal,
            );
            const content = decodeUploadContent(
              parsed.data.contentBase64,
              config.smallUploadMaxBytes,
            );
            const raw = await options.client.uploadSmallFile({
              parentItemId: parsed.data.parentItemId,
              filename: parsed.data.filename,
              content,
              ...(parsed.data.driveId !== undefined
                ? { driveId: parsed.data.driveId }
                : {}),
              signal: context.signal,
            });
            return mapUploadResponse(raw);
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
    ],
  });
}
