import {
  defineConnector,
  defineTool,
  ConnectorSdkError,
  type DefinedConnector,
} from "@osva-ai/connector-sdk";

import {
  buildScopedCql,
  filterSearchResultsByAllowlist,
} from "./cql-policy.js";
import {
  CONNECTOR_KEY,
  CONNECTOR_NAME,
  CONNECTOR_VERSION,
  CONFLUENCE_PAGE_CHILDREN_LIST_TOOL,
  CONFLUENCE_PAGE_CREATE_TOOL,
  CONFLUENCE_PAGE_GET_TOOL,
  CONFLUENCE_PAGE_LIST_TOOL,
  CONFLUENCE_PAGE_UPDATE_TOOL,
  CONFLUENCE_SEARCH_TOOL,
  CONFLUENCE_SPACE_GET_TOOL,
  CONFLUENCE_SPACE_LIST_TOOL,
  LIST_MAX_PAGE_SIZE,
} from "./constants.js";
import type { ConfluenceClient } from "./confluence-client.js";
import { mapConfluenceError } from "./map-confluence-error.js";
import {
  normalizePageDetail,
  normalizePageSummary,
  normalizeSearchHit,
  normalizeSpaceRecord,
} from "./normalize-confluence.js";
import {
  assertStructuredOutputWithinBudget,
  packListWithinOutputBudget,
} from "./output-budget.js";
import type { ConfluenceConfig } from "./schemas.js";
import {
  assertSpaceAllowed,
  createSpaceAllowlist,
  filterBySpaceAllowlist,
} from "./space-allowlist.js";
import {
  pageChildrenListInputJsonSchema,
  pageChildrenListInputSchema,
  pageCreateInputJsonSchema,
  pageCreateInputSchema,
  pageGetInputJsonSchema,
  pageGetInputSchema,
  pageListInputJsonSchema,
  pageListInputSchema,
  pageUpdateInputJsonSchema,
  pageUpdateInputSchema,
  searchInputJsonSchema,
  searchInputSchema,
  spaceGetInputJsonSchema,
  spaceGetInputSchema,
  spaceListInputJsonSchema,
  spaceListInputSchema,
} from "./tool-schemas.js";

export interface CreateConfluenceConnectorOptions {
  readonly client: ConfluenceClient;
  readonly config: ConfluenceConfig;
  readonly credentialForRedaction?: string;
}

function invalidInputError(): ConnectorSdkError {
  return new ConnectorSdkError("INVALID_INPUT", "Invalid tool input.");
}

function mapError(
  error: unknown,
  credentialForRedaction?: string,
  ambiguousWrite?: boolean,
): ConnectorSdkError {
  return mapConfluenceError(error, {
    ...(credentialForRedaction !== undefined
      ? { credential: credentialForRedaction }
      : {}),
    ...(ambiguousWrite === true ? { ambiguousWrite: true } : {}),
  });
}

function assertWritesAllowed(config: ConfluenceConfig): void {
  if (!config.writeEnabled) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Confluence mutations are disabled. Set OSVA_CONNECTOR_CONFLUENCE_WRITE_ENABLED=true to allow writes.",
    );
  }
  if (!config.hostWritesApproved) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Confluence mutations require host approval. Set OSVA_CONNECTOR_CONFLUENCE_HOST_WRITES_APPROVED=true.",
    );
  }
}

function listEnvelope(nextCursor: string | undefined): {
  readonly hasMore: boolean;
  readonly nextCursor?: string;
} {
  return {
    hasMore: nextCursor !== undefined,
    ...(nextCursor !== undefined ? { nextCursor } : {}),
  };
}

export function createConfluenceConnector(
  options: CreateConfluenceConnectorOptions,
): DefinedConnector {
  const config = options.config;
  const redactionCredential = options.credentialForRedaction;
  const allowlist = createSpaceAllowlist(config.allowedSpaceIds);

  return defineConnector({
    key: CONNECTOR_KEY,
    name: CONNECTOR_NAME,
    version: CONNECTOR_VERSION,
    description:
      "Confluence Cloud MCP connector for OSVA Connector Profile V1: bounded space and page reads, CQL search with optional space allowlist, paginated children, and controlled page mutations when explicitly enabled and host-approved. Page bodies use Confluence storage format without HTML conversion. Page text is untrusted external content.",
    tools: [
      defineTool({
        name: CONFLUENCE_SPACE_LIST_TOOL,
        description:
          "Lists Confluence spaces (v2 API) with cursor pagination. When OSVA_CONNECTOR_CONFLUENCE_ALLOWED_SPACE_IDS is set, results are filtered to allowed spaces; an explicit empty allowlist returns no spaces.",
        inputSchema: spaceListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = spaceListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const limit = Math.min(parsed.data.limit, LIST_MAX_PAGE_SIZE);
            const result = await options.client.listSpaces({
              limit,
              ...(parsed.data.cursor !== undefined
                ? { cursor: parsed.data.cursor }
                : {}),
              signal: context.signal,
            });
            const mapped = result.results
              .map((item) => normalizeSpaceRecord(item))
              .filter((space) => {
                if (allowlist === undefined) {
                  return true;
                }
                if (allowlist.allowedIds.size === 0) {
                  return false;
                }
                return allowlist.allowedIds.has(space.id);
              });
            const packed = packListWithinOutputBudget(
              listEnvelope(result.nextCursor),
              "spaces",
              mapped,
            );
            assertStructuredOutputWithinBudget(packed);
            return packed;
          } catch (error) {
            throw mapError(error, redactionCredential);
          }
        },
      }),
      defineTool({
        name: CONFLUENCE_SPACE_GET_TOOL,
        description:
          "Returns metadata for a Confluence space by numeric space ID (read-only).",
        inputSchema: spaceGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = spaceGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertSpaceAllowed(allowlist, parsed.data.spaceId, "spaceId");
          try {
            const raw = await options.client.getSpace(
              parsed.data.spaceId,
              context.signal,
            );
            const output = normalizeSpaceRecord(raw);
            assertStructuredOutputWithinBudget(output);
            return output;
          } catch (error) {
            throw mapError(error, redactionCredential);
          }
        },
      }),
      defineTool({
        name: CONFLUENCE_PAGE_LIST_TOOL,
        description:
          "Lists pages in a space with cursor pagination. Space must be on the host allowlist when configured.",
        inputSchema: pageListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = pageListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertSpaceAllowed(allowlist, parsed.data.spaceId, "spaceId");
          try {
            const limit = Math.min(parsed.data.limit, LIST_MAX_PAGE_SIZE);
            const result = await options.client.listPages({
              spaceId: parsed.data.spaceId,
              limit,
              ...(parsed.data.cursor !== undefined
                ? { cursor: parsed.data.cursor }
                : {}),
              signal: context.signal,
            });
            const mapped = result.results.map((item) =>
              normalizePageSummary(item),
            );
            const filtered = filterBySpaceAllowlist(allowlist, mapped);
            const packed = packListWithinOutputBudget(
              listEnvelope(result.nextCursor),
              "pages",
              filtered,
            );
            assertStructuredOutputWithinBudget(packed);
            return packed;
          } catch (error) {
            throw mapError(error, redactionCredential);
          }
        },
      }),
      defineTool({
        name: CONFLUENCE_PAGE_GET_TOOL,
        description:
          "Returns page metadata and storage-format body (read-only). Bodies are not converted from HTML.",
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
            const output = normalizePageDetail(raw);
            if (output.spaceId !== undefined) {
              assertSpaceAllowed(allowlist, output.spaceId, "spaceId");
            }
            assertStructuredOutputWithinBudget(output);
            return output;
          } catch (error) {
            throw mapError(error, redactionCredential);
          }
        },
      }),
      defineTool({
        name: CONFLUENCE_SEARCH_TOOL,
        description:
          "Runs CQL search via Confluence REST search. When a space allowlist is configured, CQL is scoped to allowed spaces and must not include space predicates.",
        inputSchema: searchInputJsonSchema,
        handler: async (input, context) => {
          const parsed = searchInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const scopedCql = buildScopedCql(parsed.data.cql, allowlist);
            const limit = Math.min(parsed.data.limit, LIST_MAX_PAGE_SIZE);
            const result = await options.client.search({
              cql: scopedCql,
              limit,
              ...(parsed.data.cursor !== undefined
                ? { cursor: parsed.data.cursor }
                : {}),
              signal: context.signal,
            });
            const mapped = result.results.map((item) =>
              normalizeSearchHit(item),
            );
            const filtered = filterSearchResultsByAllowlist(allowlist, mapped);
            const packed = packListWithinOutputBudget(
              listEnvelope(result.nextCursor),
              "results",
              filtered,
            );
            assertStructuredOutputWithinBudget(packed);
            return packed;
          } catch (error) {
            throw mapError(error, redactionCredential);
          }
        },
      }),
      defineTool({
        name: CONFLUENCE_PAGE_CHILDREN_LIST_TOOL,
        description:
          "Lists child pages for a parent page ID with cursor pagination.",
        inputSchema: pageChildrenListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = pageChildrenListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const parentRaw = await options.client.getPage(
              parsed.data.pageId,
              context.signal,
            );
            const parent = normalizePageSummary(parentRaw);
            if (parent.spaceId !== undefined) {
              assertSpaceAllowed(allowlist, parent.spaceId, "spaceId");
            }

            const limit = Math.min(parsed.data.limit, LIST_MAX_PAGE_SIZE);
            const result = await options.client.listPageChildren({
              pageId: parsed.data.pageId,
              limit,
              ...(parsed.data.cursor !== undefined
                ? { cursor: parsed.data.cursor }
                : {}),
              signal: context.signal,
            });
            const mapped = result.results.map((item) =>
              normalizePageSummary(item),
            );
            const filtered = filterBySpaceAllowlist(allowlist, mapped);
            const packed = packListWithinOutputBudget(
              listEnvelope(result.nextCursor),
              "pages",
              filtered,
            );
            assertStructuredOutputWithinBudget(packed);
            return packed;
          } catch (error) {
            throw mapError(error, redactionCredential);
          }
        },
      }),
      defineTool({
        name: CONFLUENCE_PAGE_CREATE_TOOL,
        description:
          "Creates a Confluence page with storage-format body (mutating). Requires host-controlled write flags. No connector-level retries.",
        inputSchema: pageCreateInputJsonSchema,
        handler: async (input, context) => {
          const parsed = pageCreateInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertWritesAllowed(config);
          assertSpaceAllowed(allowlist, parsed.data.spaceId, "spaceId");
          try {
            const raw = await options.client.createPage({
              spaceId: parsed.data.spaceId,
              title: parsed.data.title,
              bodyStorage: parsed.data.bodyStorage,
              ...(parsed.data.parentId !== undefined
                ? { parentId: parsed.data.parentId }
                : {}),
              signal: context.signal,
            });
            const output = normalizePageDetail(raw);
            assertStructuredOutputWithinBudget(output);
            return output;
          } catch (error) {
            throw mapError(error, redactionCredential, true);
          }
        },
      }),
      defineTool({
        name: CONFLUENCE_PAGE_UPDATE_TOOL,
        description:
          "Updates a Confluence page title and/or storage-format body (mutating). Requires current versionNumber for optimistic concurrency (409 on conflict). No connector-level retries.",
        inputSchema: pageUpdateInputJsonSchema,
        handler: async (input, context) => {
          const parsed = pageUpdateInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertWritesAllowed(config);
          try {
            const existingRaw = await options.client.getPage(
              parsed.data.pageId,
              context.signal,
            );
            const existing = normalizePageSummary(existingRaw);
            if (existing.spaceId !== undefined) {
              assertSpaceAllowed(allowlist, existing.spaceId, "spaceId");
            }

            const raw = await options.client.updatePage({
              pageId: parsed.data.pageId,
              versionNumber: parsed.data.versionNumber,
              ...(parsed.data.title !== undefined
                ? { title: parsed.data.title }
                : {}),
              ...(parsed.data.bodyStorage !== undefined
                ? { bodyStorage: parsed.data.bodyStorage }
                : {}),
              ...(parsed.data.versionMessage !== undefined
                ? { versionMessage: parsed.data.versionMessage }
                : {}),
              signal: context.signal,
            });
            const output = normalizePageDetail(raw);
            assertStructuredOutputWithinBudget(output);
            return output;
          } catch (error) {
            throw mapError(error, redactionCredential, true);
          }
        },
      }),
    ],
  });
}
