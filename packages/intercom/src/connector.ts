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
  INTERCOM_ADMIN_LIST_TOOL,
  INTERCOM_ALLOWED_RESOURCE_IDS_ENV,
  INTERCOM_CONTACT_GET_TOOL,
  INTERCOM_CONTACT_LIST_TOOL,
  INTERCOM_CONTACT_SEARCH_TOOL,
  INTERCOM_CONVERSATION_GET_TOOL,
  INTERCOM_CONVERSATION_LIST_TOOL,
  INTERCOM_CONVERSATION_NOTE_ADD_TOOL,
  INTERCOM_CONVERSATION_SEARCH_TOOL,
  INTERCOM_CONVERSATION_STATE_SET_TOOL,
  LIST_DEFAULT_PAGE,
  LIST_DEFAULT_PER_PAGE,
} from "./constants.js";
import {
  assertIdAllowed,
  assertMutationAllowlistConfigured,
  createStringIdAllowlist,
  filterByStringAllowlist,
} from "./id-allowlist.js";
import type { IntercomClient } from "./intercom-client.js";
import { mapIntercomError } from "./map-intercom-error.js";
import {
  buildIntercomAdminNoteBody,
  buildIntercomStateBody,
} from "./mutation-allowlist.js";
import {
  mapConversationGetResponse,
  mapConversationListResponse,
} from "./normalize-intercom.js";
import type { IntercomConfig } from "./schemas.js";
import {
  adminListInputJsonSchema,
  adminListInputSchema,
  contactGetInputJsonSchema,
  contactGetInputSchema,
  contactListInputJsonSchema,
  contactListInputSchema,
  contactSearchInputJsonSchema,
  contactSearchInputSchema,
  conversationGetInputJsonSchema,
  conversationGetInputSchema,
  conversationListInputJsonSchema,
  conversationListInputSchema,
  conversationNoteAddInputJsonSchema,
  conversationNoteAddInputSchema,
  conversationSearchInputJsonSchema,
  conversationSearchInputSchema,
  conversationStateSetInputJsonSchema,
  conversationStateSetInputSchema,
} from "./tool-schemas.js";

export interface CreateIntercomConnectorOptions {
  readonly client: IntercomClient;
  readonly config: IntercomConfig;
  readonly accessTokenForRedaction?: string;
}

function invalidInputError() {
  return new ConnectorSdkError("INVALID_INPUT", "Invalid tool input.");
}

function mapError(
  error: unknown,
  options: CreateIntercomConnectorOptions,
  ambiguous?: boolean,
) {
  return mapIntercomError(error, {
    accessToken: options.accessTokenForRedaction,
    ...(ambiguous === true ? { ambiguousWrite: true } : {}),
  });
}

function assertNotesAllowed(config: IntercomConfig): void {
  if (!config.notesEnabled) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Intercom notes are disabled (NOTES_ENABLED).",
    );
  }
  if (!config.hostWritesApproved) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Intercom mutations require HOST_WRITES_APPROVED.",
    );
  }
}

function assertStateAllowed(config: IntercomConfig): void {
  if (!config.statusEnabled) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Intercom state updates are disabled (STATUS_ENABLED).",
    );
  }
  if (!config.hostWritesApproved) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Intercom mutations require HOST_WRITES_APPROVED.",
    );
  }
}

function readConversationId(raw: unknown): string {
  if (typeof raw !== "object" || raw === null) return "";
  const id = (raw as { id?: unknown }).id;
  return id === undefined ? "" : String(id);
}

export function createIntercomConnector(
  options: CreateIntercomConnectorOptions,
): DefinedConnector {
  const { config, client } = options;
  const conversationAllowlist = createStringIdAllowlist(
    config.allowedResourceIds,
  );

  return defineConnector({
    key: CONNECTOR_KEY,
    name: CONNECTOR_NAME,
    version: CONNECTOR_VERSION,
    description:
      "Intercom MCP connector: bounded conversation/contact reads, admin notes, and open/closed state. No customer-facing replies.",
    tools: [
      defineTool({
        name: INTERCOM_CONVERSATION_LIST_TOOL,
        inputSchema: conversationListInputJsonSchema,
        description: "Lists Intercom conversations with bounded pagination.",
        handler: async (input, context) => {
          const parsed = conversationListInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          if (conversationAllowlist?.allowedIds.size === 0) {
            return {
              pageInfo: { page: 1, hasMore: false },
              conversations: [],
              untrustedContent: true as const,
            };
          }
          const page = parsed.data.page ?? LIST_DEFAULT_PAGE;
          const perPage = parsed.data.perPage ?? LIST_DEFAULT_PER_PAGE;
          try {
            const { items } = await client.listConversations(
              { page, perPage },
              context.signal,
            );
            const raw =
              typeof items === "object" && items !== null
                ? items
                : { conversations: [] };
            const list = filterByStringAllowlist(
              conversationAllowlist,
              Array.isArray((raw as { conversations?: unknown }).conversations)
                ? ((raw as { conversations: unknown[] }).conversations ?? [])
                : [],
              readConversationId,
            );
            return mapConversationListResponse(
              { conversations: list },
              page,
              config.includePii,
            );
          } catch (error) {
            throw mapError(error, options);
          }
        },
      }),
      defineTool({
        name: INTERCOM_CONVERSATION_GET_TOOL,
        inputSchema: conversationGetInputJsonSchema,
        description: "Returns one Intercom conversation.",
        handler: async (input, context) => {
          const parsed = conversationGetInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          assertIdAllowed(
            conversationAllowlist,
            parsed.data.conversationId,
            "Conversation",
          );
          try {
            return mapConversationGetResponse(
              await client.getConversation(
                parsed.data.conversationId,
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
        name: INTERCOM_CONVERSATION_SEARCH_TOOL,
        inputSchema: conversationSearchInputJsonSchema,
        description: "Searches Intercom conversations.",
        handler: async (input, context) => {
          const parsed = conversationSearchInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          const page = parsed.data.page ?? LIST_DEFAULT_PAGE;
          try {
            const raw = await client.searchConversations(
              parsed.data.query,
              page,
              context.signal,
            );
            const list =
              typeof raw === "object" &&
              raw !== null &&
              Array.isArray((raw as { conversations?: unknown }).conversations)
                ? ((raw as { conversations: unknown[] }).conversations ?? [])
                : [];
            const filtered = filterByStringAllowlist(
              conversationAllowlist,
              list,
              readConversationId,
            );
            return mapConversationListResponse(
              { conversations: filtered },
              page,
              config.includePii,
            );
          } catch (error) {
            throw mapError(error, options);
          }
        },
      }),
      defineTool({
        name: INTERCOM_CONTACT_LIST_TOOL,
        inputSchema: contactListInputJsonSchema,
        description: "Lists Intercom contacts.",
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
            const contacts =
              typeof raw === "object" &&
              raw !== null &&
              Array.isArray((raw as { data?: unknown }).data)
                ? (raw as { data: unknown[] }).data
                : [];
            return { contacts, untrustedContent: true as const };
          } catch (error) {
            throw mapError(error, options);
          }
        },
      }),
      defineTool({
        name: INTERCOM_CONTACT_GET_TOOL,
        inputSchema: contactGetInputJsonSchema,
        description: "Returns one Intercom contact.",
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
        name: INTERCOM_CONTACT_SEARCH_TOOL,
        inputSchema: contactSearchInputJsonSchema,
        description: "Searches Intercom contacts.",
        handler: async (input, context) => {
          const parsed = contactSearchInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          const page = parsed.data.page ?? LIST_DEFAULT_PAGE;
          try {
            const raw = await client.searchContacts(
              parsed.data.query,
              page,
              context.signal,
            );
            const contacts =
              typeof raw === "object" &&
              raw !== null &&
              Array.isArray((raw as { data?: unknown }).data)
                ? (raw as { data: unknown[] }).data
                : [];
            return { contacts, page, untrustedContent: true as const };
          } catch (error) {
            throw mapError(error, options);
          }
        },
      }),
      defineTool({
        name: INTERCOM_ADMIN_LIST_TOOL,
        inputSchema: adminListInputJsonSchema,
        description: "Lists Intercom admins (read-only).",
        handler: async (input, context) => {
          const parsed = adminListInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          try {
            const raw = await client.listAdmins(context.signal);
            const admins = Array.isArray(raw) ? raw : [];
            return { admins, untrustedContent: true as const };
          } catch (error) {
            throw mapError(error, options);
          }
        },
      }),
      defineTool({
        name: INTERCOM_CONVERSATION_NOTE_ADD_TOOL,
        inputSchema: conversationNoteAddInputJsonSchema,
        description:
          "Adds an admin note on a conversation. Requires NOTES_ENABLED and allowlist.",
        handler: async (input, context) => {
          assertNotesAllowed(config);
          assertMutationAllowlistConfigured(
            conversationAllowlist,
            INTERCOM_ALLOWED_RESOURCE_IDS_ENV,
          );
          const parsed = conversationNoteAddInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          assertIdAllowed(
            conversationAllowlist,
            parsed.data.conversationId,
            "Conversation",
          );
          try {
            await client.addAdminNote(
              parsed.data.conversationId,
              buildIntercomAdminNoteBody(config.adminId, parsed.data.body),
              context.signal,
            );
            return {
              conversationId: parsed.data.conversationId,
              created: true as const,
              adminNote: true as const,
            };
          } catch (error) {
            throw mapError(error, options, true);
          }
        },
      }),
      defineTool({
        name: INTERCOM_CONVERSATION_STATE_SET_TOOL,
        inputSchema: conversationStateSetInputJsonSchema,
        description:
          "Sets conversation open/closed state. Requires STATUS_ENABLED.",
        handler: async (input, context) => {
          assertStateAllowed(config);
          assertMutationAllowlistConfigured(
            conversationAllowlist,
            INTERCOM_ALLOWED_RESOURCE_IDS_ENV,
          );
          const parsed = conversationStateSetInputSchema.safeParse(input);
          if (!parsed.success) throw invalidInputError();
          assertIdAllowed(
            conversationAllowlist,
            parsed.data.conversationId,
            "Conversation",
          );
          const body = buildIntercomStateBody(
            parsed.data.state,
            config.adminId,
            config.allowedTargetStatuses,
          );
          try {
            await client.setConversationState(
              parsed.data.conversationId,
              body,
              context.signal,
            );
            return {
              conversationId: parsed.data.conversationId,
              updated: true as const,
            };
          } catch (error) {
            throw mapError(error, options, true);
          }
        },
      }),
    ],
  });
}
