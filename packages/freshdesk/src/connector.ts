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
  FRESHDESK_ALLOWED_RESOURCE_IDS_ENV,
  FRESHDESK_CONTACT_GET_TOOL,
  FRESHDESK_CONTACT_LIST_TOOL,
  FRESHDESK_TICKET_CONVERSATION_LIST_TOOL,
  FRESHDESK_TICKET_GET_TOOL,
  FRESHDESK_TICKET_LIST_TOOL,
  FRESHDESK_TICKET_NOTE_ADD_TOOL,
  FRESHDESK_TICKET_SEARCH_TOOL,
  FRESHDESK_TICKET_STATUS_SET_TOOL,
  LIST_DEFAULT_PAGE,
  LIST_DEFAULT_PER_PAGE,
} from "./constants.js";
import {
  assertIdAllowed,
  assertMutationAllowlistConfigured,
  createNumericIdAllowlist,
  filterByNumericAllowlist,
} from "./id-allowlist.js";
import type { FreshdeskConfig } from "./schemas.js";
import type { FreshdeskClient } from "./freshdesk-client.js";
import { mapFreshdeskError } from "./map-freshdesk-error.js";
import {
  buildFreshdeskPrivateNoteBody,
  buildFreshdeskStatusBody,
} from "./mutation-allowlist.js";
import {
  mapCommentListResponse,
  mapTicketGetResponse,
  mapTicketListResponse,
} from "./normalize-freshdesk.js";
import {
  contactGetInputJsonSchema,
  contactGetInputSchema,
  contactListInputJsonSchema,
  contactListInputSchema,
  ticketConversationListInputJsonSchema,
  ticketConversationListInputSchema,
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
} from "./tool-schemas.js";

export interface CreateFreshdeskConnectorOptions {
  readonly client: FreshdeskClient;
  readonly config: FreshdeskConfig;
  readonly apiKeyForRedaction?: string;
}

function invalidInputError() {
  return new ConnectorSdkError("INVALID_INPUT", "Invalid tool input.");
}

function mapError(
  error: unknown,
  options: CreateFreshdeskConnectorOptions,
  ambiguous?: boolean,
) {
  return mapFreshdeskError(error, {
    apiKey: options.apiKeyForRedaction,
    ...(ambiguous === true ? { ambiguousWrite: true } : {}),
  });
}

function assertNotesAllowed(config: FreshdeskConfig): void {
  if (!config.notesEnabled) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Freshdesk note adds are disabled (NOTES_ENABLED).",
    );
  }
  if (!config.hostWritesApproved) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Freshdesk mutations require HOST_WRITES_APPROVED.",
    );
  }
}

function assertStatusAllowed(config: FreshdeskConfig): void {
  if (!config.statusEnabled) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Freshdesk status updates are disabled (STATUS_ENABLED).",
    );
  }
  if (!config.hostWritesApproved) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Freshdesk mutations require HOST_WRITES_APPROVED.",
    );
  }
}

function readTicketId(raw: unknown): number {
  if (typeof raw !== "object" || raw === null) return Number.NaN;
  const id = (raw as { id?: unknown }).id;
  return typeof id === "number" ? id : Number.parseInt(String(id), 10);
}

export function createFreshdeskConnector(
  options: CreateFreshdeskConnectorOptions,
): DefinedConnector {
  const { config, client } = options;
  const ticketAllowlist = createNumericIdAllowlist(config.allowedResourceIds);

  return defineConnector({
    key: CONNECTOR_KEY,
    name: CONNECTOR_NAME,
    version: CONNECTOR_VERSION,
    description:
      "Freshdesk MCP connector: bounded ticket/contact reads, private note adds, and status updates. No customer-facing replies.",
    tools: [
      defineTool({
        name: FRESHDESK_TICKET_LIST_TOOL,
        inputSchema: ticketListInputJsonSchema,
        description: "Lists Freshdesk tickets with bounded pagination.",
        handler: async (input, context) => {
          const parsed = ticketListInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          if (ticketAllowlist?.allowedIds.size === 0) {
            return {
              pageInfo: { page: 1, hasMore: false },
              tickets: [],
              untrustedContent: true as const,
            };
          }
          const page = parsed.data.page ?? LIST_DEFAULT_PAGE;
          const perPage = parsed.data.perPage ?? LIST_DEFAULT_PER_PAGE;
          try {
            const { items } = await client.listTickets(
              { page, perPage },
              context.signal,
            );
            const raw =
              typeof items === "object" &&
              items !== null &&
              Array.isArray((items as { results?: unknown }).results)
                ? (items as { results: unknown[] }).results
                : Array.isArray(items)
                  ? items
                  : [];
            const filtered = filterByNumericAllowlist(
              ticketAllowlist,
              raw,
              readTicketId,
            );
            return mapTicketListResponse(
              { tickets: filtered },
              page,
              config.includePii,
            );
          } catch (error) {
            throw mapError(error, options);
          }
        },
      }),
      defineTool({
        name: FRESHDESK_TICKET_GET_TOOL,
        inputSchema: ticketGetInputJsonSchema,
        description: "Returns one Freshdesk ticket.",
        handler: async (input, context) => {
          const parsed = ticketGetInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          assertIdAllowed(ticketAllowlist, parsed.data.ticketId, "Ticket");
          try {
            return mapTicketGetResponse(
              await client.getTicket(parsed.data.ticketId, context.signal),
              config.includePii,
            );
          } catch (error) {
            throw mapError(error, options);
          }
        },
      }),
      defineTool({
        name: FRESHDESK_TICKET_SEARCH_TOOL,
        inputSchema: ticketSearchInputJsonSchema,
        description: "Searches Freshdesk tickets with bounded query length.",
        handler: async (input, context) => {
          const parsed = ticketSearchInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          const page = parsed.data.page ?? LIST_DEFAULT_PAGE;
          try {
            const raw = await client.searchTickets(
              parsed.data.query,
              page,
              context.signal,
            );
            const list =
              typeof raw === "object" &&
              raw !== null &&
              Array.isArray((raw as { results?: unknown }).results)
                ? (raw as { results: unknown[] }).results
                : [];
            const filtered = filterByNumericAllowlist(
              ticketAllowlist,
              list,
              readTicketId,
            );
            return mapTicketListResponse(
              { tickets: filtered },
              page,
              config.includePii,
            );
          } catch (error) {
            throw mapError(error, options);
          }
        },
      }),
      defineTool({
        name: FRESHDESK_TICKET_CONVERSATION_LIST_TOOL,
        inputSchema: ticketConversationListInputJsonSchema,
        description:
          "Lists ticket conversations; customer-facing bodies redacted unless INCLUDE_PII.",
        handler: async (input, context) => {
          const parsed = ticketConversationListInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          assertIdAllowed(ticketAllowlist, parsed.data.ticketId, "Ticket");
          try {
            const raw = await client.listTicketConversations(
              parsed.data.ticketId,
              context.signal,
            );
            return mapCommentListResponse(raw, config.includePii);
          } catch (error) {
            throw mapError(error, options);
          }
        },
      }),
      defineTool({
        name: FRESHDESK_CONTACT_LIST_TOOL,
        inputSchema: contactListInputJsonSchema,
        description: "Lists Freshdesk contacts.",
        handler: async (input, context) => {
          const parsed = contactListInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          const page = parsed.data.page ?? LIST_DEFAULT_PAGE;
          const perPage = parsed.data.perPage ?? LIST_DEFAULT_PER_PAGE;
          try {
            const raw = await client.listContacts(
              { page, perPage },
              context.signal,
            );
            return {
              contacts: Array.isArray(raw) ? raw : [],
              untrustedContent: true as const,
            };
          } catch (error) {
            throw mapError(error, options);
          }
        },
      }),
      defineTool({
        name: FRESHDESK_CONTACT_GET_TOOL,
        inputSchema: contactGetInputJsonSchema,
        description: "Returns one Freshdesk contact.",
        handler: async (input, context) => {
          const parsed = contactGetInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          try {
            return {
              contact: await client.getContact(
                parsed.data.contactId,
                context.signal,
              ),
              untrustedContent: true as const,
            };
          } catch (error) {
            throw mapError(error, options);
          }
        },
      }),
      defineTool({
        name: FRESHDESK_TICKET_NOTE_ADD_TOOL,
        inputSchema: ticketNoteAddInputJsonSchema,
        description:
          "Adds a private note (not a customer reply). Requires NOTES_ENABLED and allowlist.",
        handler: async (input, context) => {
          assertNotesAllowed(config);
          assertMutationAllowlistConfigured(
            ticketAllowlist,
            FRESHDESK_ALLOWED_RESOURCE_IDS_ENV,
          );
          const parsed = ticketNoteAddInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          assertIdAllowed(ticketAllowlist, parsed.data.ticketId, "Ticket");
          try {
            await client.addPrivateNote(
              parsed.data.ticketId,
              buildFreshdeskPrivateNoteBody(parsed.data.body),
              context.signal,
            );
            return {
              ticketId: parsed.data.ticketId,
              created: true as const,
              privateNote: true as const,
            };
          } catch (error) {
            throw mapError(error, options, true);
          }
        },
      }),
      defineTool({
        name: FRESHDESK_TICKET_STATUS_SET_TOOL,
        inputSchema: ticketStatusSetInputJsonSchema,
        description:
          "Sets ticket status (open/pending/resolved or 2/3/4). Requires STATUS_ENABLED.",
        handler: async (input, context) => {
          assertStatusAllowed(config);
          assertMutationAllowlistConfigured(
            ticketAllowlist,
            FRESHDESK_ALLOWED_RESOURCE_IDS_ENV,
          );
          const parsed = ticketStatusSetInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          assertIdAllowed(ticketAllowlist, parsed.data.ticketId, "Ticket");
          const body = buildFreshdeskStatusBody(
            parsed.data.status,
            config.allowedTargetStatuses,
          );
          try {
            await client.setTicketStatus(
              parsed.data.ticketId,
              body,
              context.signal,
            );
            return { ticketId: parsed.data.ticketId, updated: true as const };
          } catch (error) {
            throw mapError(error, options, true);
          }
        },
      }),
    ],
  });
}
