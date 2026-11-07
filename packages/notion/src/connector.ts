import {
  defineConnector,
  defineTool,
  ConnectorSdkError,
  type DefinedConnector,
} from "@osva-ai/connector-sdk";

import {
  CONNECTOR_KEY,
  CONNECTOR_NAME,
  CONNECTOR_VERSION,
  LIST_MAX_PAGE_SIZE,
  NOTION_BLOCK_CHILDREN_APPEND_TOOL,
  NOTION_BLOCK_CHILDREN_LIST_TOOL,
  NOTION_DATABASE_GET_TOOL,
  NOTION_DATASOURCE_GET_TOOL,
  NOTION_DATASOURCE_QUERY_TOOL,
  NOTION_PAGE_CREATE_TOOL,
  NOTION_PAGE_GET_TOOL,
  NOTION_PAGE_UPDATE_TOOL,
  NOTION_SEARCH_TOOL,
} from "./constants.js";
import { mapNotionError } from "./map-notion-error.js";
import type { NotionClient } from "./notion-client.js";
import {
  normalizeBlockList,
  normalizeDataSourceRecord,
  normalizeDatabaseRecord,
  normalizePageRecord,
  normalizeSearchResultItem,
} from "./normalize-notion.js";
import {
  assertStructuredOutputWithinBudget,
  packListWithinOutputBudget,
} from "./output-budget.js";
import type { NotionConfig } from "./schemas.js";
import {
  blockChildrenAppendInputJsonSchema,
  blockChildrenAppendInputSchema,
  blockChildrenListInputJsonSchema,
  blockChildrenListInputSchema,
  databaseGetInputJsonSchema,
  databaseGetInputSchema,
  datasourceGetInputJsonSchema,
  datasourceGetInputSchema,
  datasourceQueryInputJsonSchema,
  datasourceQueryInputSchema,
  pageCreateInputJsonSchema,
  pageCreateInputSchema,
  pageGetInputJsonSchema,
  pageGetInputSchema,
  pageUpdateInputJsonSchema,
  pageUpdateInputSchema,
  searchInputJsonSchema,
  searchInputSchema,
} from "./tool-schemas.js";

export interface CreateNotionConnectorOptions {
  readonly client: NotionClient;
  readonly config: NotionConfig;
  readonly accessTokenForRedaction?: string;
}

function invalidInputError(): ConnectorSdkError {
  return new ConnectorSdkError("INVALID_INPUT", "Invalid tool input.");
}

function mapError(
  error: unknown,
  accessTokenForRedaction?: string,
  ambiguousWrite?: boolean,
): ConnectorSdkError {
  return mapNotionError(error, {
    ...(accessTokenForRedaction !== undefined
      ? { accessToken: accessTokenForRedaction }
      : {}),
    ...(ambiguousWrite === true ? { ambiguousWrite: true } : {}),
  });
}

function assertWritesAllowed(config: NotionConfig): void {
  if (!config.writeEnabled) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Notion mutations are disabled. Set OSVA_CONNECTOR_NOTION_WRITE_ENABLED=true to allow writes.",
    );
  }
  if (!config.hostWritesApproved) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Notion mutations require host approval. Set OSVA_CONNECTOR_NOTION_HOST_WRITES_APPROVED=true.",
    );
  }
}

export function createNotionConnector(
  options: CreateNotionConnectorOptions,
): DefinedConnector {
  const config = options.config;
  const redactionToken = options.accessTokenForRedaction;

  return defineConnector({
    key: CONNECTOR_KEY,
    name: CONNECTOR_NAME,
    version: CONNECTOR_VERSION,
    description:
      "Notion MCP connector for OSVA Connector Profile V1: bounded search, page/database/data source reads, paginated block children, and controlled page/block mutations when explicitly enabled and host-approved. Page text and properties are untrusted external content. Database IDs and data source IDs are distinct — use notion.database.get to discover data source IDs before notion.datasource.query.",
    tools: [
      defineTool({
        name: NOTION_SEARCH_TOOL,
        description:
          "Searches Notion workspace objects shared with the integration (pages, databases, data sources). One Notion API call per invocation; use startCursor for pagination.",
        inputSchema: searchInputJsonSchema,
        handler: async (input, context) => {
          const parsed = searchInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const pageSize = Math.min(parsed.data.pageSize, LIST_MAX_PAGE_SIZE);
            const result = await options.client.search({
              pageSize,
              ...(parsed.data.query !== undefined
                ? { query: parsed.data.query }
                : {}),
              ...(parsed.data.startCursor !== undefined
                ? { startCursor: parsed.data.startCursor }
                : {}),
              ...(parsed.data.objectType !== undefined
                ? { filter: { value: parsed.data.objectType } }
                : {}),
              signal: context.signal,
            });
            const mapped = result.results.map((item) =>
              normalizeSearchResultItem(item),
            );
            const envelope = {
              hasMore: result.hasMore,
              ...(result.nextCursor !== undefined
                ? { nextCursor: result.nextCursor }
                : {}),
              ...(result.requestStatus !== undefined
                ? { requestStatus: result.requestStatus }
                : {}),
            };
            const packed = packListWithinOutputBudget(
              envelope,
              "results",
              mapped,
            );
            assertStructuredOutputWithinBudget(packed);
            return packed;
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: NOTION_PAGE_GET_TOOL,
        description:
          "Returns normalized metadata and structured property values for a Notion page (read-only). Rich text is extracted with explicit truncation metadata.",
        inputSchema: pageGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = pageGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const raw = await options.client.getPage(
              parsed.data.pageId,
              context.signal,
            );
            const output = normalizePageRecord(raw);
            assertStructuredOutputWithinBudget(output);
            return output;
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: NOTION_BLOCK_CHILDREN_LIST_TOOL,
        description:
          "Lists child blocks for a page or block ID with bounded pagination. Nested block payloads are shallow-normalized; use additional calls and cursors for deep trees.",
        inputSchema: blockChildrenListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = blockChildrenListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const pageSize = Math.min(parsed.data.pageSize, LIST_MAX_PAGE_SIZE);
            const result = await options.client.listBlockChildren({
              blockId: parsed.data.blockId,
              pageSize,
              ...(parsed.data.startCursor !== undefined
                ? { startCursor: parsed.data.startCursor }
                : {}),
              signal: context.signal,
            });
            const blocks = normalizeBlockList(result.results, config);
            const envelope = {
              hasMore: result.hasMore,
              ...(result.nextCursor !== undefined
                ? { nextCursor: result.nextCursor }
                : {}),
              maxBlockDepthApplied: config.maxBlockDepth,
            };
            const packed = packListWithinOutputBudget(
              envelope,
              "blocks",
              blocks,
            );
            assertStructuredOutputWithinBudget(packed);
            return packed;
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: NOTION_DATABASE_GET_TOOL,
        description:
          "Retrieves a Notion database container and lists child data source IDs (read-only). Do not use the database ID for notion.datasource.query.",
        inputSchema: databaseGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = databaseGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const raw = await options.client.getDatabase(
              parsed.data.databaseId,
              context.signal,
            );
            const output = normalizeDatabaseRecord(raw);
            assertStructuredOutputWithinBudget(output);
            return output;
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: NOTION_DATASOURCE_GET_TOOL,
        description:
          "Retrieves a Notion data source schema/metadata by data source ID (read-only).",
        inputSchema: datasourceGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = datasourceGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const raw = await options.client.getDataSource(
              parsed.data.dataSourceId,
              context.signal,
            );
            const output = normalizeDataSourceRecord(raw);
            assertStructuredOutputWithinBudget(output);
            return output;
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: NOTION_DATASOURCE_QUERY_TOOL,
        description:
          "Queries rows/pages in a data source (not a database ID). Supports filter, sorts, filter_properties, and cursor pagination with incomplete-result metadata from Notion.",
        inputSchema: datasourceQueryInputJsonSchema,
        handler: async (input, context) => {
          const parsed = datasourceQueryInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const pageSize = Math.min(parsed.data.pageSize, LIST_MAX_PAGE_SIZE);
            const result = await options.client.queryDataSource({
              dataSourceId: parsed.data.dataSourceId,
              pageSize,
              ...(parsed.data.startCursor !== undefined
                ? { startCursor: parsed.data.startCursor }
                : {}),
              ...(parsed.data.filter !== undefined
                ? { filter: parsed.data.filter }
                : {}),
              ...(parsed.data.sorts !== undefined
                ? { sorts: parsed.data.sorts }
                : {}),
              ...(parsed.data.filterProperties !== undefined
                ? { filterProperties: parsed.data.filterProperties }
                : {}),
              signal: context.signal,
            });
            const rows = result.results.map((item) =>
              normalizePageRecord(item),
            );
            const envelope = {
              hasMore: result.hasMore,
              ...(result.nextCursor !== undefined
                ? { nextCursor: result.nextCursor }
                : {}),
              ...(result.requestStatus !== undefined
                ? { requestStatus: result.requestStatus }
                : {}),
            };
            const packed = packListWithinOutputBudget(
              envelope,
              "results",
              rows,
            );
            assertStructuredOutputWithinBudget(packed);
            return packed;
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: NOTION_PAGE_CREATE_TOOL,
        description:
          "Creates a Notion page under a page, database, or data source parent (mutating). Requires host-controlled write flags. No connector-level retries.",
        inputSchema: pageCreateInputJsonSchema,
        handler: async (input, context) => {
          const parsed = pageCreateInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertWritesAllowed(config);
          try {
            const parent = parsed.data.parent;
            const parentArg =
              parent.type === "page_id"
                ? {
                    type: "page_id" as const,
                    pageId: parent.pageId,
                  }
                : parent.type === "database_id"
                  ? {
                      type: "database_id" as const,
                      databaseId: parent.databaseId,
                    }
                  : {
                      type: "data_source_id" as const,
                      dataSourceId: parent.dataSourceId,
                    };
            const raw = await options.client.createPage({
              parent: parentArg,
              ...(parsed.data.properties !== undefined
                ? { properties: parsed.data.properties }
                : {}),
              ...(parsed.data.children !== undefined
                ? { children: parsed.data.children }
                : {}),
              signal: context.signal,
            });
            const output = normalizePageRecord(raw);
            assertStructuredOutputWithinBudget(output);
            return output;
          } catch (error) {
            throw mapError(error, redactionToken, true);
          }
        },
      }),
      defineTool({
        name: NOTION_PAGE_UPDATE_TOOL,
        description:
          "Updates Notion page properties or archive state (mutating). Requires host-controlled write flags. No connector-level retries.",
        inputSchema: pageUpdateInputJsonSchema,
        handler: async (input, context) => {
          const parsed = pageUpdateInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertWritesAllowed(config);
          try {
            const raw = await options.client.updatePage({
              pageId: parsed.data.pageId,
              ...(parsed.data.properties !== undefined
                ? { properties: parsed.data.properties }
                : {}),
              ...(parsed.data.inTrash !== undefined
                ? { inTrash: parsed.data.inTrash }
                : {}),
              signal: context.signal,
            });
            const output = normalizePageRecord(raw);
            assertStructuredOutputWithinBudget(output);
            return output;
          } catch (error) {
            throw mapError(error, redactionToken, true);
          }
        },
      }),
      defineTool({
        name: NOTION_BLOCK_CHILDREN_APPEND_TOOL,
        description:
          "Appends child blocks to a page or block (mutating). Requires host-controlled write flags. Block count per call is bounded; no connector-level retries.",
        inputSchema: blockChildrenAppendInputJsonSchema,
        handler: async (input, context) => {
          const parsed = blockChildrenAppendInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertWritesAllowed(config);
          try {
            const position =
              parsed.data.position !== undefined
                ? parsed.data.position.type === "after_block"
                  ? {
                      type: "after_block" as const,
                      afterBlockId: parsed.data.position.afterBlockId,
                    }
                  : { type: parsed.data.position.type }
                : undefined;
            const raw = await options.client.appendBlockChildren({
              blockId: parsed.data.blockId,
              children: parsed.data.children,
              ...(position !== undefined ? { position } : {}),
              signal: context.signal,
            });
            const record =
              raw !== null && typeof raw === "object"
                ? (raw as Record<string, unknown>)
                : {};
            const results = Array.isArray(record.results) ? record.results : [];
            const blocks = normalizeBlockList(results, config);
            const output = { blocks, untrustedContent: true as const };
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
