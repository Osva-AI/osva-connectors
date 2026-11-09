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
  GCS_BUCKET_GET_TOOL,
  GCS_BUCKET_LIST_TOOL,
  GCS_OBJECT_LIST_TOOL,
  GCS_OBJECT_METADATA_GET_TOOL,
  GCS_OBJECT_TEXT_CREATE_TOOL,
  GCS_OBJECT_TEXT_READ_TOOL,
  GCS_OBJECT_TEXT_REPLACE_TOOL,
  GCS_OBJECT_VERSIONS_LIST_TOOL,
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
  mapBucketListResponse,
  mapObjectListResponse,
  mapObjectMetadataResponse,
  mapObjectVersionsListResponse,
} from "./normalize-object.js";
import type { GcsProviderClient } from "./provider-client.js";
import {
  assertBucketAllowed,
  assertListPrefixAllowed,
  assertObjectKeyAllowed,
} from "./resource-scope.js";
import type { GcsConfig } from "./schemas.js";
import {
  bucketGetInputJsonSchema,
  bucketGetInputSchema,
  bucketListInputJsonSchema,
  bucketListInputSchema,
  objectListInputJsonSchema,
  objectListInputSchema,
  objectMetadataGetInputJsonSchema,
  objectMetadataGetInputSchema,
  objectTextCreateInputJsonSchema,
  objectTextCreateInputSchema,
  objectTextReadInputJsonSchema,
  objectTextReadInputSchema,
  objectTextReplaceInputJsonSchema,
  objectTextReplaceInputSchema,
  objectVersionsListInputJsonSchema,
  objectVersionsListInputSchema,
} from "./tool-schemas.js";

const GCS_TEXT_WRITE_CONTENT_TYPE = "text/plain; charset=utf-8";

export interface CreateGcsConnectorOptions {
  readonly client: GcsProviderClient;
  readonly config: GcsConfig;
  readonly continuationStore?: ContinuationStore;
}

function invalidInputError(): ConnectorSdkError {
  return new ConnectorSdkError("INVALID_INPUT", "Invalid tool input.");
}

function mapError(error: unknown): ConnectorSdkError {
  return mapProviderError(error);
}

function configuredBucketNames(
  config: GcsConfig,
): readonly string[] | undefined {
  const map = config.allowedBucketsRead;
  if (map === undefined) {
    return undefined;
  }
  return Object.keys(map);
}

export function createGcsConnector(
  options: CreateGcsConnectorOptions,
): DefinedConnector {
  const { client, config } = options;
  const continuations = options.continuationStore ?? new ContinuationStore();

  function resolveBucketList(input: z.infer<typeof bucketListInputSchema>): {
    limit: number;
    providerToken?: string;
  } {
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
      bucket: string;
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
      bucket: input.bucket,
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
      "Google Cloud Storage MCP connector: bounded bucket/object metadata and UTF-8 text reads with optional gated create/replace when host-approved.",
    tools: [
      defineTool({
        name: GCS_BUCKET_LIST_TOOL,
        description:
          "List GCS buckets (configured allowlist by default; optional account-wide discovery).",
        inputSchema: bucketListInputJsonSchema,
        handler: async (input) => {
          const parsed = bucketListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          const { limit, providerToken } = resolveBucketList(parsed.data);
          try {
            if (!config.accountWideBucketDiscovery) {
              const allowed = configuredBucketNames(config);
              if (allowed !== undefined) {
                const buckets = allowed.map((name) => ({ name }));
                return mapBucketListResponse({ buckets });
              }
            }
            const result = await client.listBuckets({
              maxResults: limit,
              ...(providerToken !== undefined
                ? { continuationToken: providerToken }
                : {}),
            });
            let buckets = result.buckets;
            const allowed = configuredBucketNames(config);
            if (!config.accountWideBucketDiscovery && allowed !== undefined) {
              const allowSet = new Set(allowed);
              buckets = buckets.filter((bucket) => allowSet.has(bucket.name));
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
            return mapBucketListResponse({ buckets }, continuationToken);
          } catch (error) {
            throw mapError(error);
          }
        },
      }),
      defineTool({
        name: GCS_BUCKET_GET_TOOL,
        description: "Get GCS bucket metadata (head bucket).",
        inputSchema: bucketGetInputJsonSchema,
        handler: async (input) => {
          const parsed = bucketGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertBucketAllowed(config.allowedBucketsRead, parsed.data.bucket);
          try {
            await client.headBucket(parsed.data.bucket);
            return { bucket: parsed.data.bucket, reachable: true as const };
          } catch (error) {
            throw mapError(error);
          }
        },
      }),
      defineTool({
        name: GCS_OBJECT_LIST_TOOL,
        description: "List object keys under an allowed bucket/prefix.",
        inputSchema: objectListInputJsonSchema,
        handler: async (input) => {
          const parsed = objectListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          const { prefix, limit, providerToken } = resolveScopedList(
            parsed.data,
            "object.list",
          );
          assertBucketAllowed(config.allowedBucketsRead, parsed.data.bucket);
          assertListPrefixAllowed(
            config.allowedBucketsRead,
            parsed.data.bucket,
            prefix,
          );
          try {
            const result = await client.listObjects({
              bucket: parsed.data.bucket,
              prefix,
              maxKeys: limit,
              ...(providerToken !== undefined
                ? { continuationToken: providerToken }
                : {}),
            });
            let continuationToken: string | undefined;
            if (result.continuationToken !== undefined) {
              continuationToken = continuations.issue(
                {
                  connectorKey: CONNECTOR_KEY,
                  family: "object.list",
                  bucket: parsed.data.bucket,
                  prefix,
                  pageSize: limit,
                },
                result.continuationToken,
              );
            }
            return mapObjectListResponse(result, continuationToken);
          } catch (error) {
            throw mapError(error);
          }
        },
      }),
      defineTool({
        name: GCS_OBJECT_METADATA_GET_TOOL,
        description: "Get GCS object metadata without downloading body.",
        inputSchema: objectMetadataGetInputJsonSchema,
        handler: async (input) => {
          const parsed = objectMetadataGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertObjectKeyAllowed(
            config.allowedBucketsRead,
            parsed.data.bucket,
            parsed.data.key,
          );
          try {
            const metadata = await client.headObject(
              parsed.data.bucket,
              parsed.data.key,
            );
            return mapObjectMetadataResponse(metadata);
          } catch (error) {
            throw mapError(error);
          }
        },
      }),
      defineTool({
        name: GCS_OBJECT_TEXT_READ_TOOL,
        description:
          "Read bounded UTF-8 text object content (MIME allowlist). Untrusted external content.",
        inputSchema: objectTextReadInputJsonSchema,
        handler: async (input, context) => {
          const parsed = objectTextReadInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertObjectKeyAllowed(
            config.allowedBucketsRead,
            parsed.data.bucket,
            parsed.data.key,
          );
          try {
            return await readBoundedTextObject(
              client,
              parsed.data.bucket,
              parsed.data.key,
              context.signal,
            );
          } catch (error) {
            throw mapError(error);
          }
        },
      }),
      defineTool({
        name: GCS_OBJECT_TEXT_CREATE_TOOL,
        description:
          "Create a new text object (ifGenerationMatch=0). Requires create + host approval env flags.",
        inputSchema: objectTextCreateInputJsonSchema,
        handler: async (input) => {
          const parsed = objectTextCreateInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertCreateAllowed(config);
          assertObjectKeyAllowed(
            config.allowedBucketsWrite,
            parsed.data.bucket,
            parsed.data.key,
          );
          const body = encodeWriteContent(parsed.data.content);
          try {
            const result = await client.createObject({
              bucket: parsed.data.bucket,
              key: parsed.data.key,
              body,
              contentType: GCS_TEXT_WRITE_CONTENT_TYPE,
            });
            return result;
          } catch (error) {
            throw mapError(error);
          }
        },
      }),
      defineTool({
        name: GCS_OBJECT_TEXT_REPLACE_TOOL,
        description:
          "Replace object contents when ifGenerationMatch matches. Requires replace + host approval.",
        inputSchema: objectTextReplaceInputJsonSchema,
        handler: async (input) => {
          const parsed = objectTextReplaceInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertReplaceAllowed(config);
          assertObjectKeyAllowed(
            config.allowedBucketsWrite,
            parsed.data.bucket,
            parsed.data.key,
          );
          const body = encodeWriteContent(parsed.data.content);
          try {
            const result = await client.replaceObject({
              bucket: parsed.data.bucket,
              key: parsed.data.key,
              body,
              contentType: GCS_TEXT_WRITE_CONTENT_TYPE,
              expectedGeneration: parsed.data.expectedGeneration,
            });
            return result;
          } catch (error) {
            throw mapError(error);
          }
        },
      }),
      defineTool({
        name: GCS_OBJECT_VERSIONS_LIST_TOOL,
        description:
          "List bounded object version metadata for an allowed bucket/prefix.",
        inputSchema: objectVersionsListInputJsonSchema,
        handler: async (input) => {
          const parsed = objectVersionsListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          const { prefix, limit, providerToken } = resolveScopedList(
            parsed.data,
            "object.versions.list",
          );
          assertBucketAllowed(config.allowedBucketsRead, parsed.data.bucket);
          assertListPrefixAllowed(
            config.allowedBucketsRead,
            parsed.data.bucket,
            prefix,
          );
          try {
            const result = await client.listObjectVersions({
              bucket: parsed.data.bucket,
              prefix,
              maxKeys: limit,
              ...(providerToken !== undefined
                ? { continuationToken: providerToken }
                : {}),
            });
            let continuationToken: string | undefined;
            if (result.continuationToken !== undefined) {
              continuationToken = continuations.issue(
                {
                  connectorKey: CONNECTOR_KEY,
                  family: "object.versions.list",
                  bucket: parsed.data.bucket,
                  prefix,
                  pageSize: limit,
                },
                result.continuationToken,
              );
            }
            return mapObjectVersionsListResponse(result, continuationToken);
          } catch (error) {
            throw mapError(error);
          }
        },
      }),
    ],
  });
}
