import {
  defineConnector,
  defineTool,
  ConnectorSdkError,
  type DefinedConnector,
} from "@osva-ai/connector-sdk";

import {
  assertIndexAllowed,
  assertNamespaceAllowed,
  createIndexAllowlist,
  createNamespaceAllowlist,
  filterIndexesByAllowlist,
} from "./allowlist.js";
import {
  CONNECTOR_KEY,
  CONNECTOR_NAME,
  CONNECTOR_VERSION,
  PINECONE_INDEX_DESCRIBE_TOOL,
  PINECONE_INDEX_LIST_TOOL,
  PINECONE_INDEX_STATS_TOOL,
  PINECONE_VECTOR_FETCH_TOOL,
  PINECONE_VECTOR_LIST_TOOL,
  PINECONE_VECTOR_QUERY_TOOL,
  PINECONE_VECTOR_UPSERT_TOOL,
} from "./constants.js";
import { mapPineconeError } from "./map-pinecone-error.js";
import {
  normalizeDataPlaneResponse,
  normalizeDescribeIndexResponse,
  normalizeIndexListResponse,
} from "./normalize-pinecone.js";
import {
  assertStructuredOutputWithinBudget,
  packListWithinOutputBudget,
} from "./output-budget.js";
import { parsePineconeMetadataFilter } from "./metadata-filter.js";
import type { PineconeClient } from "./pinecone-client.js";
import type { PineconeConfig } from "./schemas.js";
import {
  indexDescribeInputJsonSchema,
  indexDescribeInputSchema,
  indexListInputJsonSchema,
  indexListInputSchema,
  indexStatsInputJsonSchema,
  indexStatsInputSchema,
  vectorFetchInputJsonSchema,
  vectorFetchInputSchema,
  vectorListInputJsonSchema,
  vectorListInputSchema,
  vectorQueryInputJsonSchema,
  vectorQueryInputSchema,
  vectorUpsertInputJsonSchema,
  vectorUpsertInputSchema,
} from "./tool-schemas.js";

export interface CreatePineconeConnectorOptions {
  readonly client: PineconeClient;
  readonly config: PineconeConfig;
  readonly apiKeyForRedaction?: string;
}

function invalidInputError(): ConnectorSdkError {
  return new ConnectorSdkError("INVALID_INPUT", "Invalid tool input.");
}

function mapError(
  error: unknown,
  apiKeyForRedaction?: string,
  ambiguousWrite?: boolean,
): ConnectorSdkError {
  return mapPineconeError(error, {
    ...(apiKeyForRedaction !== undefined ? { apiKey: apiKeyForRedaction } : {}),
    ...(ambiguousWrite === true ? { ambiguousWrite: true } : {}),
  });
}

function assertWritesAllowed(config: PineconeConfig): void {
  if (!config.writeEnabled) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Pinecone writes are disabled. Set OSVA_CONNECTOR_PINECONE_WRITE_ENABLED=true to allow upsert.",
    );
  }
  if (!config.hostWritesApproved) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Pinecone writes require host approval (OSVA_CONNECTOR_PINECONE_HOST_WRITES_APPROVED=true).",
    );
  }
}

export function createPineconeConnector(
  options: CreatePineconeConnectorOptions,
): DefinedConnector {
  const { config, client } = options;
  const redactionToken = options.apiKeyForRedaction ?? config.apiKey;
  const indexAllowlist = createIndexAllowlist(config.allowedIndexes);
  const namespaceAllowlist = createNamespaceAllowlist(config.allowedNamespaces);

  function guardIndexAndNamespace(indexName: string, namespace?: string): void {
    assertIndexAllowed(indexAllowlist, indexName);
    assertNamespaceAllowed(namespaceAllowlist, namespace);
  }

  return defineConnector({
    key: CONNECTOR_KEY,
    name: CONNECTOR_NAME,
    version: CONNECTOR_VERSION,
    description:
      "Pinecone MCP connector for OSVA Connector Profile V1: list and describe indexes; dense-vector query, fetch, list, and stats on provider data-plane hosts resolved from describe (never from tool input); gated vector upsert. Pinecone API key and allowlists are environment-only. Control plane uses https://api.pinecone.io with Api-Key and X-Pinecone-Api-Version 2025-04.",
    tools: [
      defineTool({
        name: PINECONE_INDEX_LIST_TOOL,
        description:
          "Lists Pinecone indexes (control plane GET /indexes). Respects OSVA_CONNECTOR_PINECONE_ALLOWED_INDEXES when set.",
        inputSchema: indexListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = indexListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const raw = await client.listIndexes(context.signal);
            const normalized = normalizeIndexListResponse(raw);
            const names = filterIndexesByAllowlist(
              indexAllowlist,
              normalized.indexes.map((i) => i.name),
            );
            const packed = packListWithinOutputBudget(
              {} as Record<string, unknown>,
              "indexes",
              names.map((name) => ({ name })),
            );
            assertStructuredOutputWithinBudget(packed);
            return packed;
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: PINECONE_INDEX_DESCRIBE_TOOL,
        description:
          "Describes a Pinecone index (control plane GET /indexes/{name}). Data-plane host comes from this response only.",
        inputSchema: indexDescribeInputJsonSchema,
        handler: async (input, context) => {
          const parsed = indexDescribeInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertIndexAllowed(indexAllowlist, parsed.data.indexName);
          try {
            const raw = await client.describeIndex(
              parsed.data.indexName,
              context.signal,
            );
            const index = normalizeDescribeIndexResponse(raw);
            const output = { index };
            assertStructuredOutputWithinBudget(output);
            return output;
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: PINECONE_INDEX_STATS_TOOL,
        description:
          "Returns index stats from the Pinecone data plane (POST /describe_index_stats).",
        inputSchema: indexStatsInputJsonSchema,
        handler: async (input, context) => {
          const parsed = indexStatsInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          guardIndexAndNamespace(parsed.data.indexName, parsed.data.namespace);
          try {
            const raw = await client.describeIndexStats({
              indexName: parsed.data.indexName,
              ...(parsed.data.namespace !== undefined
                ? { namespace: parsed.data.namespace }
                : {}),
              signal: context.signal,
            });
            const stats = normalizeDataPlaneResponse(raw);
            const output = { stats };
            assertStructuredOutputWithinBudget(output);
            return output;
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: PINECONE_VECTOR_QUERY_TOOL,
        description:
          "Dense vector similarity query (data plane POST /query). Sparse and integrated-embedding indexes are rejected.",
        inputSchema: vectorQueryInputJsonSchema,
        handler: async (input, context) => {
          const parsed = vectorQueryInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          guardIndexAndNamespace(parsed.data.indexName, parsed.data.namespace);
          const filter =
            parsed.data.filter !== undefined
              ? parsePineconeMetadataFilter(parsed.data.filter)
              : undefined;
          try {
            const raw = await client.queryVectors({
              indexName: parsed.data.indexName,
              vector: parsed.data.vector,
              topK: parsed.data.topK,
              ...(parsed.data.namespace !== undefined
                ? { namespace: parsed.data.namespace }
                : {}),
              ...(filter !== undefined ? { filter } : {}),
              ...(parsed.data.includeMetadata !== undefined
                ? { includeMetadata: parsed.data.includeMetadata }
                : {}),
              ...(parsed.data.includeValues !== undefined
                ? { includeValues: parsed.data.includeValues }
                : {}),
              signal: context.signal,
            });
            const result = normalizeDataPlaneResponse(raw);
            const output = { result };
            assertStructuredOutputWithinBudget(output);
            return output;
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: PINECONE_VECTOR_FETCH_TOOL,
        description: "Fetches vectors by ID (data plane GET /vectors/fetch).",
        inputSchema: vectorFetchInputJsonSchema,
        handler: async (input, context) => {
          const parsed = vectorFetchInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          guardIndexAndNamespace(parsed.data.indexName, parsed.data.namespace);
          try {
            const raw = await client.fetchVectors({
              indexName: parsed.data.indexName,
              ids: parsed.data.ids,
              ...(parsed.data.namespace !== undefined
                ? { namespace: parsed.data.namespace }
                : {}),
              signal: context.signal,
            });
            const result = normalizeDataPlaneResponse(raw);
            const output = { result };
            assertStructuredOutputWithinBudget(output);
            return output;
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: PINECONE_VECTOR_LIST_TOOL,
        description:
          "Lists vector IDs with pagination (data plane POST /vectors/list).",
        inputSchema: vectorListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = vectorListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          guardIndexAndNamespace(parsed.data.indexName, parsed.data.namespace);
          try {
            const raw = await client.listVectors({
              indexName: parsed.data.indexName,
              limit: parsed.data.limit,
              ...(parsed.data.namespace !== undefined
                ? { namespace: parsed.data.namespace }
                : {}),
              ...(parsed.data.paginationToken !== undefined
                ? { paginationToken: parsed.data.paginationToken }
                : {}),
              signal: context.signal,
            });
            const result = normalizeDataPlaneResponse(raw);
            const output = { result };
            assertStructuredOutputWithinBudget(output);
            return output;
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: PINECONE_VECTOR_UPSERT_TOOL,
        description:
          "Upserts dense vectors (data plane POST /vectors/upsert). Requires write flags. Sparse and integrated-embedding indexes are rejected.",
        inputSchema: vectorUpsertInputJsonSchema,
        handler: async (input, context) => {
          const parsed = vectorUpsertInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertWritesAllowed(config);
          guardIndexAndNamespace(parsed.data.indexName, parsed.data.namespace);
          try {
            const vectors = parsed.data.vectors.map((vector) => ({
              id: vector.id,
              values: vector.values,
              ...(vector.metadata !== undefined
                ? { metadata: vector.metadata }
                : {}),
            }));
            const raw = await client.upsertVectors({
              indexName: parsed.data.indexName,
              vectors,
              ...(parsed.data.namespace !== undefined
                ? { namespace: parsed.data.namespace }
                : {}),
              signal: context.signal,
            });
            const result = normalizeDataPlaneResponse(raw);
            const output = { result, writePerformed: true as const };
            assertStructuredOutputWithinBudget(output);
            return output;
          } catch (error) {
            throw mapError(error, redactionToken, true);
          }
        },
      }),
    ],
  });
}
