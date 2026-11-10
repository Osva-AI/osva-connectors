import {
  defineConnector,
  defineTool,
  ConnectorSdkError,
  type DefinedConnector,
} from "@osva-ai/connector-sdk";
import type { z } from "zod";

import {
  CONNECTOR_KEY,
  CONNECTOR_NAME,
  CONNECTOR_VERSION,
  LIST_DEFAULT_PAGE_SIZE,
  AZURE_BLOB_CONTAINER_GET_TOOL,
  AZURE_BLOB_CONTAINER_LIST_TOOL,
  AZURE_BLOB_BLOB_LIST_TOOL,
  AZURE_BLOB_BLOB_METADATA_GET_TOOL,
  AZURE_BLOB_BLOB_TEXT_CREATE_TOOL,
  AZURE_BLOB_BLOB_TEXT_READ_TOOL,
  AZURE_BLOB_BLOB_TEXT_REPLACE_TOOL,
  AZURE_BLOB_BLOB_VERSIONS_LIST_TOOL,
} from "./constants.js";
import { encodeWriteContent } from "./content-policy.js";
import { readBoundedTextObject } from "./object-text-read.js";
import { ContinuationStore } from "./continuation-store.js";
import { mapProviderError } from "./map-provider-error.js";
import {
  assertCreateAllowed,
  assertReplaceAllowed,
} from "./mutation-policy.js";
import {
  defaultListPageSize,
  mapContainerListResponse,
  mapObjectListResponse,
  mapObjectMetadataResponse,
  mapObjectVersionsListResponse,
} from "./normalize-object.js";
import type { AzureBlobProviderClient } from "./provider-client.js";
import {
  assertContainerAllowed,
  assertListPrefixAllowed,
  assertBlobKeyAllowed,
  filterKeysByAuthorizedPrefixes,
} from "./resource-scope.js";
import type { AzureBlobConfig } from "./schemas.js";
import {
  blobListInputJsonSchema,
  blobListInputSchema,
  blobMetadataGetInputJsonSchema,
  blobMetadataGetInputSchema,
  blobTextCreateInputJsonSchema,
  blobTextCreateInputSchema,
  blobTextReadInputJsonSchema,
  blobTextReadInputSchema,
  blobTextReplaceInputJsonSchema,
  blobTextReplaceInputSchema,
  blobVersionsListInputJsonSchema,
  blobVersionsListInputSchema,
  containerGetInputJsonSchema,
  containerGetInputSchema,
  containerListInputJsonSchema,
  containerListInputSchema,
} from "./tool-schemas.js";

const AZURE_BLOB_TEXT_WRITE_CONTENT_TYPE = "text/plain; charset=utf-8";

export interface CreateAzureBlobConnectorOptions {
  readonly client: AzureBlobProviderClient;
  readonly config: AzureBlobConfig;
  readonly continuationStore?: ContinuationStore;
}

function invalidInputError(): ConnectorSdkError {
  return new ConnectorSdkError("INVALID_INPUT", "Invalid tool input.");
}

function mapError(error: unknown): ConnectorSdkError {
  return mapProviderError(error);
}

function configuredContainerNames(
  config: AzureBlobConfig,
): readonly string[] | undefined {
  const map = config.allowedContainersRead;
  if (map === undefined) {
    return undefined;
  }
  return Object.keys(map);
}

export function createAzureBlobConnector(
  options: CreateAzureBlobConnectorOptions,
): DefinedConnector {
  const { client, config } = options;
  const continuations = options.continuationStore ?? new ContinuationStore();

  function resolveContainerList(
    input: z.infer<typeof containerListInputSchema>,
  ): { limit: number; providerToken?: string } {
    const limit = defaultListPageSize(input.limit, LIST_DEFAULT_PAGE_SIZE);
    const scope = {
      connectorKey: CONNECTOR_KEY,
      family: "bucket.list" as const,
      prefix: "",
      pageSize: limit,
    };
    if (input.continuationToken !== undefined) {
      const providerToken = continuations.resolve(
        input.continuationToken,
        scope,
      );
      return { limit, providerToken };
    }
    return { limit };
  }

  function resolveScopedList(
    input: {
      container: string;
      prefix: string;
      limit?: number;
      continuationToken?: string;
    },
    family: "object.list" | "object.versions.list",
  ): { prefix: string; limit: number; providerToken?: string } {
    const prefix = input.prefix;
    const limit = defaultListPageSize(input.limit, LIST_DEFAULT_PAGE_SIZE);
    const scope = {
      connectorKey: CONNECTOR_KEY,
      family,
      bucket: input.container,
      prefix,
      pageSize: limit,
    };
    if (input.continuationToken !== undefined) {
      const providerToken = continuations.resolve(
        input.continuationToken,
        scope,
      );
      return { prefix, limit, providerToken };
    }
    return { prefix, limit };
  }

  return defineConnector({
    key: CONNECTOR_KEY,
    name: CONNECTOR_NAME,
    version: CONNECTOR_VERSION,
    description:
      "Azure Blob Storage MCP connector: bounded container/object metadata and UTF-8 text reads with optional gated create/replace when host-approved.",
    tools: [
      defineTool({
        name: AZURE_BLOB_CONTAINER_LIST_TOOL,
        description:
          "List Azure Blob containers (configured allowlist by default; optional account-wide discovery).",
        inputSchema: containerListInputJsonSchema,
        handler: async (input) => {
          const parsed = containerListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          const { limit, providerToken } = resolveContainerList(parsed.data);
          try {
            if (!config.accountWideContainerDiscovery) {
              const allowed = configuredContainerNames(config);
              if (allowed !== undefined) {
                const containers = allowed.map((name) => ({ name }));
                return mapContainerListResponse({ containers });
              }
            }
            const result = await client.listBuckets({
              maxResults: limit,
              ...(providerToken !== undefined
                ? { continuationToken: providerToken }
                : {}),
            });
            let containers = result.buckets.map((entry) => ({
              name: entry.name,
            }));
            const allowed = configuredContainerNames(config);
            if (
              !config.accountWideContainerDiscovery &&
              allowed !== undefined
            ) {
              const allowSet = new Set(allowed);
              containers = containers.filter((container) =>
                allowSet.has(container.name),
              );
            }
            let continuationToken: string | undefined;
            if (result.continuationToken !== undefined) {
              continuationToken = continuations.issue(
                {
                  connectorKey: CONNECTOR_KEY,
                  family: "bucket.list",
                  prefix: "",
                  pageSize: limit,
                },
                result.continuationToken,
              );
            }
            return mapContainerListResponse({ containers }, continuationToken);
          } catch (error) {
            throw mapError(error);
          }
        },
      }),
      defineTool({
        name: AZURE_BLOB_CONTAINER_GET_TOOL,
        description: "Get Azure Blob container metadata (head container).",
        inputSchema: containerGetInputJsonSchema,
        handler: async (input) => {
          const parsed = containerGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertContainerAllowed(
            config.allowedContainersRead,
            parsed.data.container,
          );
          try {
            await client.headBucket(parsed.data.container);
            return {
              container: parsed.data.container,
              reachable: true as const,
            };
          } catch (error) {
            throw mapError(error);
          }
        },
      }),
      defineTool({
        name: AZURE_BLOB_BLOB_LIST_TOOL,
        description: "List object keys under an allowed container/prefix.",
        inputSchema: blobListInputJsonSchema,
        handler: async (input) => {
          const parsed = blobListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          const { prefix, limit, providerToken } = resolveScopedList(
            parsed.data,
            "object.list",
          );
          assertContainerAllowed(
            config.allowedContainersRead,
            parsed.data.container,
          );
          assertListPrefixAllowed(
            config.allowedContainersRead,
            parsed.data.container,
            prefix,
          );
          try {
            const result = await client.listObjects({
              bucket: parsed.data.container,
              prefix,
              maxKeys: limit,
              ...(providerToken !== undefined
                ? { continuationToken: providerToken }
                : {}),
            });
            const objects = filterKeysByAuthorizedPrefixes(
              config.allowedContainersRead,
              parsed.data.container,
              result.objects,
            );
            let continuationToken: string | undefined;
            if (result.continuationToken !== undefined) {
              continuationToken = continuations.issue(
                {
                  connectorKey: CONNECTOR_KEY,
                  family: "object.list",
                  bucket: parsed.data.container,
                  prefix,
                  pageSize: limit,
                },
                result.continuationToken,
              );
            }
            return mapObjectListResponse(
              { ...result, objects },
              continuationToken,
            );
          } catch (error) {
            throw mapError(error);
          }
        },
      }),
      defineTool({
        name: AZURE_BLOB_BLOB_METADATA_GET_TOOL,
        description: "Get Azure Blob object metadata without downloading body.",
        inputSchema: blobMetadataGetInputJsonSchema,
        handler: async (input) => {
          const parsed = blobMetadataGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertBlobKeyAllowed(
            config.allowedContainersRead,
            parsed.data.container,
            parsed.data.key,
          );
          try {
            const metadata = await client.headObject(
              parsed.data.container,
              parsed.data.key,
            );
            return mapObjectMetadataResponse(metadata);
          } catch (error) {
            throw mapError(error);
          }
        },
      }),
      defineTool({
        name: AZURE_BLOB_BLOB_TEXT_READ_TOOL,
        description:
          "Read bounded UTF-8 text object content (MIME allowlist). Untrusted external content.",
        inputSchema: blobTextReadInputJsonSchema,
        handler: async (input, context) => {
          const parsed = blobTextReadInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertBlobKeyAllowed(
            config.allowedContainersRead,
            parsed.data.container,
            parsed.data.key,
          );
          try {
            return await readBoundedTextObject(
              client,
              parsed.data.container,
              parsed.data.key,
              context.signal,
            );
          } catch (error) {
            throw mapError(error);
          }
        },
      }),
      defineTool({
        name: AZURE_BLOB_BLOB_TEXT_CREATE_TOOL,
        description:
          "Create a new text object (If-None-Match: *). Requires create + host approval env flags.",
        inputSchema: blobTextCreateInputJsonSchema,
        handler: async (input) => {
          const parsed = blobTextCreateInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertCreateAllowed(config);
          assertBlobKeyAllowed(
            config.allowedContainersWrite,
            parsed.data.container,
            parsed.data.key,
          );
          const body = encodeWriteContent(parsed.data.content);
          try {
            const result = await client.createObject({
              bucket: parsed.data.container,
              key: parsed.data.key,
              body,
              contentType: AZURE_BLOB_TEXT_WRITE_CONTENT_TYPE,
            });
            return {
              container: result.bucket,
              key: result.key,
              ...(result.etag !== undefined ? { etag: result.etag } : {}),
            };
          } catch (error) {
            throw mapError(error);
          }
        },
      }),
      defineTool({
        name: AZURE_BLOB_BLOB_TEXT_REPLACE_TOOL,
        description:
          "Replace object contents when If-Match ETag matches. Requires replace + host approval.",
        inputSchema: blobTextReplaceInputJsonSchema,
        handler: async (input) => {
          const parsed = blobTextReplaceInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertReplaceAllowed(config);
          assertBlobKeyAllowed(
            config.allowedContainersWrite,
            parsed.data.container,
            parsed.data.key,
          );
          const body = encodeWriteContent(parsed.data.content);
          try {
            const result = await client.replaceObject({
              bucket: parsed.data.container,
              key: parsed.data.key,
              body,
              contentType: AZURE_BLOB_TEXT_WRITE_CONTENT_TYPE,
              expectedETag: parsed.data.expectedETag,
            });
            return {
              container: result.bucket,
              key: result.key,
              ...(result.etag !== undefined ? { etag: result.etag } : {}),
            };
          } catch (error) {
            throw mapError(error);
          }
        },
      }),
      defineTool({
        name: AZURE_BLOB_BLOB_VERSIONS_LIST_TOOL,
        description:
          "List bounded blob version metadata for an allowed container/prefix.",
        inputSchema: blobVersionsListInputJsonSchema,
        handler: async (input) => {
          const parsed = blobVersionsListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          const { prefix, limit, providerToken } = resolveScopedList(
            parsed.data,
            "object.versions.list",
          );
          assertContainerAllowed(
            config.allowedContainersRead,
            parsed.data.container,
          );
          assertListPrefixAllowed(
            config.allowedContainersRead,
            parsed.data.container,
            prefix,
          );
          try {
            const result = await client.listObjectVersions({
              bucket: parsed.data.container,
              prefix,
              maxKeys: limit,
              ...(providerToken !== undefined
                ? { continuationToken: providerToken }
                : {}),
            });
            const versions = filterKeysByAuthorizedPrefixes(
              config.allowedContainersRead,
              parsed.data.container,
              result.versions,
            );
            let continuationToken: string | undefined;
            if (result.continuationToken !== undefined) {
              continuationToken = continuations.issue(
                {
                  connectorKey: CONNECTOR_KEY,
                  family: "object.versions.list",
                  bucket: parsed.data.container,
                  prefix,
                  pageSize: limit,
                },
                result.continuationToken,
              );
            }
            return mapObjectVersionsListResponse(
              { ...result, versions },
              continuationToken,
            );
          } catch (error) {
            throw mapError(error);
          }
        },
      }),
    ],
  });
}
