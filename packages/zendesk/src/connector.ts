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
  ZENDESK_ALLOWED_RESOURCE_IDS_ENV,
  ZENDESK_TICKET_COMMENT_LIST_TOOL,
  ZENDESK_TICKET_GET_TOOL,
  ZENDESK_TICKET_LIST_TOOL,
  ZENDESK_TICKET_NOTE_ADD_TOOL,
  ZENDESK_TICKET_SEARCH_TOOL,
  ZENDESK_TICKET_STATUS_SET_TOOL,
  ZENDESK_USER_GET_TOOL,
} from "./constants.js";
import {
  assertIdAllowed,
  assertMutationAllowlistConfigured,
  createNumericIdAllowlist,
  filterByNumericAllowlist,
} from "./id-allowlist.js";
import { mapZendeskError } from "./map-zendesk-error.js";
import {
  buildZendeskInternalNoteBody,
  buildZendeskTicketStatusBody,
} from "./mutation-allowlist.js";
import {
  extractTicketUpdatedStamp,
  mapCommentListResponse,
  mapNoteAddResponse,
  mapStatusSetResponse,
  mapTicketGetResponse,
  mapTicketListResponse,
  mapTicketSearchResponse,
  mapUserGetResponse,
} from "./normalize-zendesk.js";
import type { ZendeskConfig } from "./schemas.js";
import {
  ticketCommentListInputJsonSchema,
  ticketCommentListInputSchema,
  ticketGetInputJsonSchema,
  ticketGetInputSchema,
  ticketListInputJsonSchema,
  ticketListInputSchema,
  ticketNoteAddInputJsonSchema,
  ticketNoteAddInputSchema,
  ticketSearchInputJsonSchema,
  ticketSearchInputSchema,
  ticketStatusSetInputJsonSchema,
  ticketStatusSetInputSchema,
  userGetInputJsonSchema,
  userGetInputSchema,
} from "./tool-schemas.js";
import type { ZendeskClient } from "./zendesk-client.js";

export interface CreateZendeskConnectorOptions {
  readonly client: ZendeskClient;
  readonly config: ZendeskConfig;
  readonly credentialsForRedaction?: {
    readonly email: string;
    readonly apiToken: string;
  };
}

function invalidInputError() {
  return new ConnectorSdkError("INVALID_INPUT", "Invalid tool input.");
}

function mapConnectorError(
  error: unknown,
  options: CreateZendeskConnectorOptions,
  ambiguousWrite?: boolean,
): ConnectorSdkError {
  return mapZendeskError(error, {
    email: options.credentialsForRedaction?.email,
    apiToken: options.credentialsForRedaction?.apiToken,
    ...(ambiguousWrite === true ? { ambiguousWrite: true } : {}),
  });
}

function assertNotesAllowed(config: ZendeskConfig): void {
  if (!config.notesEnabled) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Zendesk internal notes are disabled. Set OSVA_CONNECTOR_ZENDESK_NOTES_ENABLED=true.",
    );
  }
  if (!config.hostWritesApproved) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Zendesk mutations require host approval (OSVA_CONNECTOR_ZENDESK_HOST_WRITES_APPROVED=true).",
    );
  }
}

function assertStatusAllowed(config: ZendeskConfig): void {
  if (!config.statusEnabled) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Zendesk status updates are disabled. Set OSVA_CONNECTOR_ZENDESK_STATUS_ENABLED=true.",
    );
  }
  if (!config.hostWritesApproved) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Zendesk mutations require host approval (OSVA_CONNECTOR_ZENDESK_HOST_WRITES_APPROVED=true).",
    );
  }
}

function readTicketId(raw: unknown): number {
  if (typeof raw === "object" && raw === null) {
    return Number.NaN;
  }
  const id =
    typeof raw === "object" && raw !== null
      ? (raw as { id?: unknown }).id
      : undefined;
  return typeof id === "number" ? id : Number.parseInt(String(id), 10);
}

export function createZendeskConnector(
  options: CreateZendeskConnectorOptions,
): DefinedConnector {
  const { config, client } = options;
  const ticketAllowlist = createNumericIdAllowlist(config.allowedResourceIds);
  const includePii = config.includePii;

  return defineConnector({
    key: CONNECTOR_KEY,
    name: CONNECTOR_NAME,
    version: CONNECTOR_VERSION,
    description:
      "Zendesk Support MCP connector (Profile V1): bounded ticket reads, typed search, internal notes, and status updates with host allowlists. Does not send customer-facing public replies.",
    tools: [
      defineTool({
        name: ZENDESK_TICKET_LIST_TOOL,
        description:
          "Lists Zendesk tickets with cursor pagination (page[size]/page[after]). Respects OSVA_CONNECTOR_ZENDESK_ALLOWED_RESOURCE_IDS when set.",
        inputSchema: ticketListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = ticketListInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          if (ticketAllowlist?.allowedIds.size === 0) {
            return {
              pageInfo: { hasMore: false },
              tickets: [],
              untrustedContent: true as const,
            };
          }
          const limit = parsed.data.limit ?? LIST_DEFAULT_LIMIT;
          try {
            const { items, nextCursor } = await client.listTickets(
              {
                limit,
                ...(parsed.data.cursor !== undefined
                  ? { cursor: parsed.data.cursor }
                  : {}),
              },
              context.signal,
            );
            const ticketsRaw =
              typeof items === "object" &&
              items !== null &&
              Array.isArray((items as { tickets?: unknown }).tickets)
                ? (items as { tickets: unknown[] }).tickets
                : [];
            const filtered = filterByNumericAllowlist(
              ticketAllowlist,
              ticketsRaw,
              readTicketId,
            );
            return mapTicketListResponse(
              { tickets: filtered },
              nextCursor,
              includePii,
            );
          } catch (error) {
            throw mapConnectorError(error, options);
          }
        },
      }),
      defineTool({
        name: ZENDESK_TICKET_GET_TOOL,
        description:
          "Returns bounded ticket metadata without full comment history.",
        inputSchema: ticketGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = ticketGetInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          assertIdAllowed(ticketAllowlist, parsed.data.ticketId, "Ticket");
          try {
            return mapTicketGetResponse(
              await client.getTicket(parsed.data.ticketId, context.signal),
              includePii,
            );
          } catch (error) {
            throw mapConnectorError(error, options);
          }
        },
      }),
      defineTool({
        name: ZENDESK_TICKET_SEARCH_TOOL,
        description:
          "Searches tickets using a typed allowlisted query (type:ticket plus status and updatedSince). Search indexing is eventually consistent.",
        inputSchema: ticketSearchInputJsonSchema,
        handler: async (input, context) => {
          const parsed = ticketSearchInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          const page = parsed.data.page ?? 1;
          const limit = parsed.data.limit ?? LIST_DEFAULT_LIMIT;
          try {
            const { items } = await client.searchTickets(
              {
                page,
                limit,
                ...(parsed.data.status !== undefined
                  ? { status: parsed.data.status }
                  : {}),
                ...(parsed.data.updatedSince !== undefined
                  ? { updatedSince: parsed.data.updatedSince }
                  : {}),
              },
              context.signal,
            );
            const output = mapTicketSearchResponse(items, page, includePii);
            if (ticketAllowlist !== undefined) {
              output.tickets = filterByNumericAllowlist(
                ticketAllowlist,
                output.tickets,
                (t) => (typeof t.id === "number" ? t.id : Number.NaN),
              ) as typeof output.tickets;
            }
            return output;
          } catch (error) {
            throw mapConnectorError(error, options);
          }
        },
      }),
      defineTool({
        name: ZENDESK_TICKET_COMMENT_LIST_TOOL,
        description:
          "Lists ticket comments with public/private flags; public bodies are redacted by default.",
        inputSchema: ticketCommentListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = ticketCommentListInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          assertIdAllowed(ticketAllowlist, parsed.data.ticketId, "Ticket");
          const limit = parsed.data.limit ?? LIST_DEFAULT_LIMIT;
          try {
            const { items, nextCursor } = await client.listTicketComments(
              parsed.data.ticketId,
              limit,
              parsed.data.cursor,
              context.signal,
            );
            return mapCommentListResponse(items, nextCursor, includePii);
          } catch (error) {
            throw mapConnectorError(error, options);
          }
        },
      }),
      defineTool({
        name: ZENDESK_USER_GET_TOOL,
        description:
          "Returns selected user metadata; email and phone omitted unless PII is enabled.",
        inputSchema: userGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = userGetInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          try {
            return mapUserGetResponse(
              await client.getUser(parsed.data.userId, context.signal),
              includePii,
            );
          } catch (error) {
            throw mapConnectorError(error, options);
          }
        },
      }),
      defineTool({
        name: ZENDESK_TICKET_NOTE_ADD_TOOL,
        description:
          "Adds an internal private note (public:false enforced). Requires NOTES_ENABLED, host approval, and allowlisted ticket id.",
        inputSchema: ticketNoteAddInputJsonSchema,
        handler: async (input, context) => {
          assertNotesAllowed(config);
          assertMutationAllowlistConfigured(
            ticketAllowlist,
            ZENDESK_ALLOWED_RESOURCE_IDS_ENV,
          );
          const parsed = ticketNoteAddInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          assertIdAllowed(ticketAllowlist, parsed.data.ticketId, "Ticket");
          try {
            const current = await client.getTicket(
              parsed.data.ticketId,
              context.signal,
            );
            const updatedStamp = extractTicketUpdatedStamp(current);
            const body = buildZendeskInternalNoteBody(
              parsed.data.body,
              updatedStamp,
            );
            const raw = await client.updateTicket(
              parsed.data.ticketId,
              body,
              context.signal,
            );
            return mapNoteAddResponse(raw, parsed.data.ticketId);
          } catch (error) {
            throw mapConnectorError(error, options, true);
          }
        },
      }),
      defineTool({
        name: ZENDESK_TICKET_STATUS_SET_TOOL,
        description:
          "Sets ticket status without attaching a comment. Requires STATUS_ENABLED, host approval, and allowlisted ticket id.",
        inputSchema: ticketStatusSetInputJsonSchema,
        handler: async (input, context) => {
          assertStatusAllowed(config);
          assertMutationAllowlistConfigured(
            ticketAllowlist,
            ZENDESK_ALLOWED_RESOURCE_IDS_ENV,
          );
          const parsed = ticketStatusSetInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          assertIdAllowed(ticketAllowlist, parsed.data.ticketId, "Ticket");
          try {
            const current = await client.getTicket(
              parsed.data.ticketId,
              context.signal,
            );
            const updatedStamp = extractTicketUpdatedStamp(current);
            const body = buildZendeskTicketStatusBody(
              parsed.data.status,
              updatedStamp,
              config.allowedTargetStatuses,
            );
            const raw = await client.updateTicket(
              parsed.data.ticketId,
              body,
              context.signal,
            );
            return mapStatusSetResponse(raw, parsed.data.ticketId);
          } catch (error) {
            throw mapConnectorError(error, options, true);
          }
        },
      }),
    ],
  });
}
