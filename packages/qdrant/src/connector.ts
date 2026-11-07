import {
  defineConnector,
  defineTool,
  ConnectorSdkError,
  type DefinedConnector,
} from "@osva-ai/connector-sdk";

import {
  assertCollectionAllowed,
  createCollectionAllowlist,
  filterCollectionsByAllowlist,
} from "./allowlist.js";
import {
  CONNECTOR_KEY,
  CONNECTOR_NAME,
  CONNECTOR_VERSION,
  QDRANT_COLLECTION_GET_TOOL,
  QDRANT_COLLECTION_LIST_TOOL,
  QDRANT_POINT_COUNT_TOOL,
  QDRANT_POINT_GET_TOOL,
  QDRANT_POINT_QUERY_TOOL,
  QDRANT_POINT_SCROLL_TOOL,
  QDRANT_POINT_UPSERT_TOOL,
} from "./constants.js";
import { mapQdrantError } from "./map-qdrant-error.js";
import {
  normalizeCollectionGetResponse,
  normalizeCollectionListResponse,
  normalizePointsResult,
} from "./normalize-qdrant.js";
import {
  assertStructuredOutputWithinBudget,
  packListWithinOutputBudget,
} from "./output-budget.js";
import { parseQdrantMetadataFilter } from "./metadata-filter.js";
import type { QdrantClient } from "./qdrant-client.js";
import type { QdrantConfig } from "./schemas.js";
import {
  collectionGetInputJsonSchema,
  collectionGetInputSchema,
  collectionListInputJsonSchema,
  collectionListInputSchema,
  pointCountInputJsonSchema,
  pointCountInputSchema,
  pointGetInputJsonSchema,
  pointGetInputSchema,
  pointQueryInputJsonSchema,
  pointQueryInputSchema,
  pointScrollInputJsonSchema,
  pointScrollInputSchema,
  pointUpsertInputJsonSchema,
  pointUpsertInputSchema,
} from "./tool-schemas.js";

export interface CreateQdrantConnectorOptions {
  readonly client: QdrantClient;
  readonly config: QdrantConfig;
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
  return mapQdrantError(error, {
    ...(apiKeyForRedaction !== undefined ? { apiKey: apiKeyForRedaction } : {}),
    ...(ambiguousWrite === true ? { ambiguousWrite: true } : {}),
  });
}

function assertWritesAllowed(config: QdrantConfig): void {
  if (!config.writeEnabled) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Qdrant writes are disabled. Set OSVA_CONNECTOR_QDRANT_WRITE_ENABLED=true to allow upsert.",
    );
  }
  if (!config.hostWritesApproved) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Qdrant writes require host approval (OSVA_CONNECTOR_QDRANT_HOST_WRITES_APPROVED=true).",
    );
  }
}

export function createQdrantConnector(
  options: CreateQdrantConnectorOptions,
): DefinedConnector {
  const { config, client } = options;
  const redactionToken = options.apiKeyForRedaction ?? config.apiKey;
  const allowlist = createCollectionAllowlist(config.allowedCollections);

  return defineConnector({
    key: CONNECTOR_KEY,
    name: CONNECTOR_NAME,
    version: CONNECTOR_VERSION,
    description:
      "Qdrant MCP connector for OSVA Connector Profile V1: list and describe collections; read, scroll, query, and count points; gated point upsert. Qdrant URL and credentials are configured via environment variables only (api-key header). Collection allowlists and write gates are host-controlled.",
    tools: [
      defineTool({
        name: QDRANT_COLLECTION_LIST_TOOL,
        description:
          "Lists Qdrant collections (GET /collections). Respects OSVA_CONNECTOR_QDRANT_ALLOWED_COLLECTIONS when set.",
        inputSchema: collectionListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = collectionListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const raw = await client.listCollections(context.signal);
            const normalized = normalizeCollectionListResponse(raw);
            const names = filterCollectionsByAllowlist(
              allowlist,
              normalized.collections.map((c) => c.name),
            );
            const collections = names.map((name) => ({ name }));
            const packed = packListWithinOutputBudget(
              {} as Record<string, unknown>,
              "collections",
              collections,
            );
            assertStructuredOutputWithinBudget(packed);
            return packed;
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: QDRANT_COLLECTION_GET_TOOL,
        description:
          "Returns Qdrant collection metadata (GET /collections/{name}).",
        inputSchema: collectionGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = collectionGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertCollectionAllowed(allowlist, parsed.data.collectionName);
          try {
            const raw = await client.getCollection(
              parsed.data.collectionName,
              context.signal,
            );
            const collection = normalizeCollectionGetResponse(raw);
            const output = { collection };
            assertStructuredOutputWithinBudget(output);
            return output;
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: QDRANT_POINT_GET_TOOL,
        description:
          "Retrieves points by ID (POST /collections/{name}/points).",
        inputSchema: pointGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = pointGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertCollectionAllowed(allowlist, parsed.data.collectionName);
          try {
            const raw = await client.getPoints({
              collectionName: parsed.data.collectionName,
              ids: parsed.data.ids,
              ...(parsed.data.withPayload !== undefined
                ? { withPayload: parsed.data.withPayload }
                : {}),
              ...(parsed.data.withVector !== undefined
                ? { withVector: parsed.data.withVector }
                : {}),
              signal: context.signal,
            });
            const result = normalizePointsResult(raw);
            const output = { result };
            assertStructuredOutputWithinBudget(output);
            return output;
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: QDRANT_POINT_SCROLL_TOOL,
        description:
          "Scrolls points in a collection (POST /collections/{name}/points/scroll).",
        inputSchema: pointScrollInputJsonSchema,
        handler: async (input, context) => {
          const parsed = pointScrollInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertCollectionAllowed(allowlist, parsed.data.collectionName);
          const filter =
            parsed.data.filter !== undefined
              ? parseQdrantMetadataFilter(parsed.data.filter)
              : undefined;
          try {
            const raw = await client.scrollPoints({
              collectionName: parsed.data.collectionName,
              limit: parsed.data.limit,
              ...(parsed.data.offset !== undefined
                ? { offset: parsed.data.offset }
                : {}),
              ...(filter !== undefined ? { filter } : {}),
              ...(parsed.data.withPayload !== undefined
                ? { withPayload: parsed.data.withPayload }
                : {}),
              ...(parsed.data.withVector !== undefined
                ? { withVector: parsed.data.withVector }
                : {}),
              signal: context.signal,
            });
            const result = normalizePointsResult(raw);
            const output = { result };
            assertStructuredOutputWithinBudget(output);
            return output;
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: QDRANT_POINT_QUERY_TOOL,
        description:
          "Nearest-neighbor query by dense vector (POST /collections/{name}/points/query).",
        inputSchema: pointQueryInputJsonSchema,
        handler: async (input, context) => {
          const parsed = pointQueryInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertCollectionAllowed(allowlist, parsed.data.collectionName);
          const filter =
            parsed.data.filter !== undefined
              ? parseQdrantMetadataFilter(parsed.data.filter)
              : undefined;
          try {
            const raw = await client.queryPoints({
              collectionName: parsed.data.collectionName,
              vector: parsed.data.vector,
              limit: parsed.data.limit,
              ...(filter !== undefined ? { filter } : {}),
              ...(parsed.data.withPayload !== undefined
                ? { withPayload: parsed.data.withPayload }
                : {}),
              ...(parsed.data.withVector !== undefined
                ? { withVector: parsed.data.withVector }
                : {}),
              ...(parsed.data.scoreThreshold !== undefined
                ? { scoreThreshold: parsed.data.scoreThreshold }
                : {}),
              signal: context.signal,
            });
            const result = normalizePointsResult(raw);
            const output = { result };
            assertStructuredOutputWithinBudget(output);
            return output;
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: QDRANT_POINT_COUNT_TOOL,
        description:
          "Counts points in a collection (POST /collections/{name}/points/count).",
        inputSchema: pointCountInputJsonSchema,
        handler: async (input, context) => {
          const parsed = pointCountInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertCollectionAllowed(allowlist, parsed.data.collectionName);
          const filter =
            parsed.data.filter !== undefined
              ? parseQdrantMetadataFilter(parsed.data.filter)
              : undefined;
          try {
            const raw = await client.countPoints({
              collectionName: parsed.data.collectionName,
              ...(filter !== undefined ? { filter } : {}),
              ...(parsed.data.exact !== undefined
                ? { exact: parsed.data.exact }
                : {}),
              signal: context.signal,
            });
            const result = normalizePointsResult(raw);
            const output = { result };
            assertStructuredOutputWithinBudget(output);
            return output;
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: QDRANT_POINT_UPSERT_TOOL,
        description:
          "Upserts points (PUT /collections/{name}/points). Requires OSVA_CONNECTOR_QDRANT_WRITE_ENABLED and OSVA_CONNECTOR_QDRANT_HOST_WRITES_APPROVED.",
        inputSchema: pointUpsertInputJsonSchema,
        handler: async (input, context) => {
          const parsed = pointUpsertInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertWritesAllowed(config);
          assertCollectionAllowed(allowlist, parsed.data.collectionName);
          try {
            const points = parsed.data.points.map((point) => ({
              id: point.id,
              vector: point.vector,
              ...(point.payload !== undefined
                ? { payload: point.payload }
                : {}),
            }));
            const raw = await client.upsertPoints({
              collectionName: parsed.data.collectionName,
              points,
              signal: context.signal,
            });
            const result = normalizePointsResult(raw);
            const output = {
              result,
              writePerformed: true as const,
              writeWaitForCompletion: true as const,
            };
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
