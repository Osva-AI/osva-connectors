import {
  ConnectorSdkError,
  defineConnector,
  defineTool,
  type DefinedConnector,
} from "@osva-ai/connector-sdk";
import {
  CONNECTOR_KEY,
  CONNECTOR_NAME,
  CONNECTOR_VERSION,
  LIST_DEFAULT_LIMIT,
  PIPEDRIVE_ALLOWED_DEAL_IDS_ENV,
  PIPEDRIVE_DEAL_GET_TOOL,
  PIPEDRIVE_DEAL_LIST_TOOL,
  PIPEDRIVE_DEAL_SEARCH_TOOL,
  PIPEDRIVE_DEAL_STAGE_SET_TOOL,
  PIPEDRIVE_ORGANIZATION_GET_TOOL,
  PIPEDRIVE_ORGANIZATION_LIST_TOOL,
  PIPEDRIVE_PERSON_GET_TOOL,
  PIPEDRIVE_PERSON_LIST_TOOL,
  PIPEDRIVE_PIPELINE_LIST_TOOL,
  PIPEDRIVE_STAGE_LIST_TOOL,
} from "./constants.js";
import {
  assertIdAllowed,
  assertMutationAllowlistConfigured,
  createNumericIdAllowlist,
  filterByNumericAllowlist,
} from "./id-allowlist.js";
import { mapPipedriveError } from "./map-pipedrive-error.js";
import { buildPipedriveDealStageBody } from "./mutation-allowlist.js";
import {
  mapDealGetResponse,
  mapDealListResponse,
  mapDealSearchResponse,
  mapDealStageSetResponse,
  mapOrganizationGetResponse,
  mapOrganizationListResponse,
  mapPersonGetResponse,
  mapPersonListResponse,
  mapPipelineListResponse,
  mapStageListResponse,
} from "./normalize-pipedrive.js";
import { extractPipedriveDataRows } from "./pipedrive-rest-client.js";
import type { PipedriveClient } from "./pipedrive-client.js";
import type { PipedriveConfig } from "./schemas.js";
import {
  dealGetInputJsonSchema,
  dealGetInputSchema,
  dealListInputJsonSchema,
  dealListInputSchema,
  dealSearchInputJsonSchema,
  dealSearchInputSchema,
  dealStageSetInputJsonSchema,
  dealStageSetInputSchema,
  organizationGetInputJsonSchema,
  organizationGetInputSchema,
  organizationListInputJsonSchema,
  organizationListInputSchema,
  personGetInputJsonSchema,
  personGetInputSchema,
  personListInputJsonSchema,
  personListInputSchema,
  pipelineListInputJsonSchema,
  pipelineListInputSchema,
  stageListInputJsonSchema,
  stageListInputSchema,
} from "./tool-schemas.js";

export interface CreatePipedriveConnectorOptions {
  readonly client: PipedriveClient;
  readonly config: PipedriveConfig;
  readonly apiTokenForRedaction?: string;
}

function invalidInputError() {
  return new ConnectorSdkError("INVALID_INPUT", "Invalid tool input.");
}

function mapError(
  error: unknown,
  options: CreatePipedriveConnectorOptions,
  ambiguous?: boolean,
) {
  return mapPipedriveError(error, {
    apiToken: options.apiTokenForRedaction,
    ...(ambiguous === true ? { ambiguousWrite: true } : {}),
  });
}

function assertStageMutationAllowed(config: PipedriveConfig): void {
  if (!config.stageUpdatesEnabled) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Pipedrive deal stage updates are disabled (STAGE_UPDATES_ENABLED).",
    );
  }
  if (!config.hostWritesApproved) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Pipedrive mutations require HOST_WRITES_APPROVED.",
    );
  }
}

function readDealId(raw: unknown): number {
  if (typeof raw !== "object" || raw === null) return Number.NaN;
  const id = (raw as { id?: unknown }).id;
  return typeof id === "number" ? id : Number.parseInt(String(id), 10);
}

export function createPipedriveConnector(
  options: CreatePipedriveConnectorOptions,
): DefinedConnector {
  const { config, client } = options;
  const dealAllowlist = createNumericIdAllowlist(config.allowedDealIds);

  return defineConnector({
    key: CONNECTOR_KEY,
    name: CONNECTOR_NAME,
    version: CONNECTOR_VERSION,
    description:
      "Pipedrive MCP connector: bounded CRM reads and optional deal stage updates.",
    tools: [
      defineTool({
        name: PIPEDRIVE_PIPELINE_LIST_TOOL,
        inputSchema: pipelineListInputJsonSchema,
        description: "Lists Pipedrive deal pipelines.",
        handler: async (input, context) => {
          const parsed = pipelineListInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          const limit = parsed.data.limit ?? LIST_DEFAULT_LIMIT;
          try {
            const raw = await client.listPipelines(
              {
                limit,
                ...(parsed.data.cursor !== undefined
                  ? { cursor: parsed.data.cursor }
                  : {}),
              },
              context.signal,
            );
            return mapPipelineListResponse(raw);
          } catch (error) {
            throw mapError(error, options);
          }
        },
      }),
      defineTool({
        name: PIPEDRIVE_STAGE_LIST_TOOL,
        inputSchema: stageListInputJsonSchema,
        description: "Lists Pipedrive pipeline stages.",
        handler: async (input, context) => {
          const parsed = stageListInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          const limit = parsed.data.limit ?? LIST_DEFAULT_LIMIT;
          try {
            const raw = await client.listStages(
              {
                limit,
                ...(parsed.data.cursor !== undefined
                  ? { cursor: parsed.data.cursor }
                  : {}),
                ...(parsed.data.pipelineId !== undefined
                  ? { pipelineId: parsed.data.pipelineId }
                  : {}),
              },
              context.signal,
            );
            return mapStageListResponse(raw);
          } catch (error) {
            throw mapError(error, options);
          }
        },
      }),
      defineTool({
        name: PIPEDRIVE_DEAL_LIST_TOOL,
        inputSchema: dealListInputJsonSchema,
        description: "Lists Pipedrive deals with bounded cursor pagination.",
        handler: async (input, context) => {
          const parsed = dealListInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          if (dealAllowlist?.allowedIds.size === 0) {
            return {
              pageInfo: { hasMore: false },
              deals: [],
              untrustedContent: true as const,
            };
          }
          const limit = parsed.data.limit ?? LIST_DEFAULT_LIMIT;
          try {
            const { items, nextCursor } = await client.listDeals(
              {
                limit,
                ...(parsed.data.cursor !== undefined
                  ? { cursor: parsed.data.cursor }
                  : {}),
              },
              context.signal,
            );
            const rows = extractPipedriveDataRows(items);
            const filtered = filterByNumericAllowlist(
              dealAllowlist,
              rows,
              readDealId,
            );
            return mapDealListResponse({ data: filtered }, nextCursor);
          } catch (error) {
            throw mapError(error, options);
          }
        },
      }),
      defineTool({
        name: PIPEDRIVE_DEAL_GET_TOOL,
        inputSchema: dealGetInputJsonSchema,
        description: "Returns one Pipedrive deal.",
        handler: async (input, context) => {
          const parsed = dealGetInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          assertIdAllowed(dealAllowlist, parsed.data.dealId, "Deal");
          try {
            return mapDealGetResponse(
              await client.getDeal(parsed.data.dealId, context.signal),
            );
          } catch (error) {
            throw mapError(error, options);
          }
        },
      }),
      defineTool({
        name: PIPEDRIVE_DEAL_SEARCH_TOOL,
        inputSchema: dealSearchInputJsonSchema,
        description: "Searches Pipedrive deals with bounded term length.",
        handler: async (input, context) => {
          const parsed = dealSearchInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          const limit = parsed.data.limit ?? LIST_DEFAULT_LIMIT;
          try {
            const raw = await client.searchDeals(
              parsed.data.term,
              {
                limit,
                ...(parsed.data.cursor !== undefined
                  ? { cursor: parsed.data.cursor }
                  : {}),
              },
              context.signal,
            );
            const list = extractPipedriveDataRows(raw);
            const filtered = filterByNumericAllowlist(
              dealAllowlist,
              list,
              readDealId,
            );
            return mapDealSearchResponse({ data: filtered });
          } catch (error) {
            throw mapError(error, options);
          }
        },
      }),
      defineTool({
        name: PIPEDRIVE_PERSON_LIST_TOOL,
        inputSchema: personListInputJsonSchema,
        description:
          "Lists Pipedrive persons; contact PII omitted unless INCLUDE_PII.",
        handler: async (input, context) => {
          const parsed = personListInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          const limit = parsed.data.limit ?? LIST_DEFAULT_LIMIT;
          try {
            const { items, nextCursor } = await client.listPersons(
              {
                limit,
                ...(parsed.data.cursor !== undefined
                  ? { cursor: parsed.data.cursor }
                  : {}),
              },
              context.signal,
            );
            return mapPersonListResponse(items, nextCursor, config.includePii);
          } catch (error) {
            throw mapError(error, options);
          }
        },
      }),
      defineTool({
        name: PIPEDRIVE_PERSON_GET_TOOL,
        inputSchema: personGetInputJsonSchema,
        description:
          "Returns one Pipedrive person; contact PII omitted unless INCLUDE_PII.",
        handler: async (input, context) => {
          const parsed = personGetInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          try {
            return mapPersonGetResponse(
              await client.getPerson(parsed.data.personId, context.signal),
              config.includePii,
            );
          } catch (error) {
            throw mapError(error, options);
          }
        },
      }),
      defineTool({
        name: PIPEDRIVE_ORGANIZATION_LIST_TOOL,
        inputSchema: organizationListInputJsonSchema,
        description:
          "Lists Pipedrive organizations; addresses omitted unless INCLUDE_PII.",
        handler: async (input, context) => {
          const parsed = organizationListInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          const limit = parsed.data.limit ?? LIST_DEFAULT_LIMIT;
          try {
            const { items, nextCursor } = await client.listOrganizations(
              {
                limit,
                ...(parsed.data.cursor !== undefined
                  ? { cursor: parsed.data.cursor }
                  : {}),
              },
              context.signal,
            );
            return mapOrganizationListResponse(
              items,
              nextCursor,
              config.includePii,
            );
          } catch (error) {
            throw mapError(error, options);
          }
        },
      }),
      defineTool({
        name: PIPEDRIVE_ORGANIZATION_GET_TOOL,
        inputSchema: organizationGetInputJsonSchema,
        description:
          "Returns one Pipedrive organization; addresses omitted unless INCLUDE_PII.",
        handler: async (input, context) => {
          const parsed = organizationGetInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          try {
            return mapOrganizationGetResponse(
              await client.getOrganization(
                parsed.data.organizationId,
                context.signal,
              ),
              config.includePii,
            );
          } catch (error) {
            throw mapError(error, options);
          }
        },
      }),
      defineTool({
        name: PIPEDRIVE_DEAL_STAGE_SET_TOOL,
        inputSchema: dealStageSetInputJsonSchema,
        description:
          "Sets a deal stage. Requires STAGE_ENABLED, HOST_WRITES_APPROVED, and deal allowlist.",
        handler: async (input, context) => {
          assertStageMutationAllowed(config);
          assertMutationAllowlistConfigured(
            dealAllowlist,
            PIPEDRIVE_ALLOWED_DEAL_IDS_ENV,
          );
          const parsed = dealStageSetInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          assertIdAllowed(dealAllowlist, parsed.data.dealId, "Deal");
          const body = buildPipedriveDealStageBody(
            parsed.data.targetStageId,
            config.allowedStageIds,
          );
          try {
            await client.setDealStage(parsed.data.dealId, body, context.signal);
            return mapDealStageSetResponse(
              parsed.data.dealId,
              parsed.data.targetStageId,
            );
          } catch (error) {
            throw mapError(error, options, true);
          }
        },
      }),
    ],
  });
}
