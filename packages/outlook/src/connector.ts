import {
  ConnectorSdkError,
  defineConnector,
  defineTool,
  type DefinedConnector,
} from "@osva-ai/connector-sdk";

import {
  createCalendarAllowlist,
  assertCalendarAllowed,
  assertCalendarMutationsAllowlistReady,
  filterByCalendarAllowlist,
} from "./calendar-allowlist.js";
import {
  CONNECTOR_KEY,
  CONNECTOR_NAME,
  CONNECTOR_VERSION,
  GRAPH_API_HOST,
  LIST_MAX_PAGE_SIZE,
  OUTLOOK_CALENDAR_LIST_TOOL,
  OUTLOOK_EVENT_CREATE_TOOL,
  OUTLOOK_EVENT_GET_TOOL,
  OUTLOOK_EVENT_LIST_TOOL,
  OUTLOOK_MAIL_FOLDER_LIST_TOOL,
  OUTLOOK_MESSAGE_GET_TOOL,
  OUTLOOK_MESSAGE_LIST_TOOL,
  OUTLOOK_MESSAGE_SEARCH_TOOL,
  OUTLOOK_MESSAGE_SEND_TOOL,
} from "./constants.js";
import {
  OUTLOOK_NEXT_LINK_SCOPES,
  validateNextLinkInput,
} from "./graph-pagination.js";
import { mapGraphError } from "./map-graph-error.js";
import {
  createMailFolderAllowlist,
  assertMailFolderAllowed,
  filterByMailFolderAllowlist,
} from "./mail-folder-allowlist.js";
import {
  mapCalendarListResponse,
  mapEventCreateResponse,
  mapEventGetResponse,
  mapEventListResponse,
  mapMailFolderListResponse,
  mapMessageGetResponse,
  mapMessageListResponse,
  mapSendMailResponse,
} from "./normalize-outlook.js";
import type { OutlookClient } from "./outlook-client.js";
import {
  assertStructuredOutputWithinBudget,
  packListWithinOutputBudget,
} from "./output-budget.js";
import type { OutlookConfig } from "./schemas.js";
import {
  assertRecipientsAllowedByHostPolicy,
  assertSendEnabledAndApproved,
  assertWritesEnabledAndApproved,
  buildGraphSendMailPayload,
} from "./send-policy.js";
import {
  calendarListInputJsonSchema,
  calendarListInputSchema,
  collectRecipientEmails,
  eventCreateInputJsonSchema,
  eventCreateInputSchema,
  eventGetInputJsonSchema,
  eventGetInputSchema,
  eventListInputJsonSchema,
  eventListInputSchema,
  mailFolderListInputJsonSchema,
  mailFolderListInputSchema,
  messageGetInputJsonSchema,
  messageGetInputSchema,
  messageListInputJsonSchema,
  messageListInputSchema,
  messageSearchInputJsonSchema,
  messageSearchInputSchema,
  messageSendInputJsonSchema,
  messageSendInputSchema,
} from "./tool-schemas.js";

export interface CreateOutlookConnectorOptions {
  readonly client: OutlookClient;
  readonly config: OutlookConfig;
  readonly accessTokenForRedaction?: string;
  readonly graphApiHost?: string;
}

function invalidInputError(): ConnectorSdkError {
  return new ConnectorSdkError("INVALID_INPUT", "Invalid tool input.");
}

function mapError(
  error: unknown,
  accessTokenForRedaction?: string,
  ambiguousMutation?: boolean,
): ConnectorSdkError {
  return mapGraphError(error, {
    ...(accessTokenForRedaction !== undefined
      ? { accessToken: accessTokenForRedaction }
      : {}),
    ...(ambiguousMutation === true ? { ambiguousMutation: true } : {}),
  });
}

export function createOutlookConnector(
  options: CreateOutlookConnectorOptions,
): DefinedConnector {
  const config = options.config;
  const redact = options.accessTokenForRedaction;
  const graphHost = options.graphApiHost ?? GRAPH_API_HOST;
  const mailFolderAllowlist = createMailFolderAllowlist(
    config.allowedMailFolderIds,
  );
  const calendarAllowlist = createCalendarAllowlist(config.allowedCalendarIds);

  return defineConnector({
    key: CONNECTOR_KEY,
    name: CONNECTOR_NAME,
    version: CONNECTOR_VERSION,
    description:
      "Outlook MCP connector for OSVA Connector Profile V1: bounded mailbox and calendar reads via Microsoft Graph (delegated /me only), and controlled message send and calendar event create when explicitly enabled and host-approved. Mail and calendar text are untrusted external data. Sends and writes are non-idempotent — the connector does not retry them automatically.",
    tools: [
      defineTool({
        name: OUTLOOK_MAIL_FOLDER_LIST_TOOL,
        description:
          "Lists mail folders (GET /me/mailFolders) with bounded pagination.",
        inputSchema: mailFolderListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = mailFolderListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const nextLink = validateNextLinkInput(
              parsed.data.nextLink,
              graphHost,
              OUTLOOK_NEXT_LINK_SCOPES.mailFolders,
            );
            const top = Math.min(parsed.data.pageSize, LIST_MAX_PAGE_SIZE);
            const raw = await options.client.listMailFolders({
              top,
              ...(nextLink !== undefined ? { nextLink } : {}),
              signal: context.signal,
            });
            const mapped = mapMailFolderListResponse(raw, graphHost);
            const filtered = filterByMailFolderAllowlist(
              mailFolderAllowlist,
              mapped.mailFolders,
              (f) => f.id,
            );
            const packed = packListWithinOutputBudget(
              {
                ...(mapped.nextLink !== undefined
                  ? { nextLink: mapped.nextLink }
                  : {}),
                untrustedContent: true as const,
              },
              "mailFolders",
              filtered,
            );
            assertStructuredOutputWithinBudget(packed);
            return packed;
          } catch (error) {
            throw mapError(error, redact);
          }
        },
      }),

      defineTool({
        name: OUTLOOK_MESSAGE_LIST_TOOL,
        description:
          "Lists messages in a mail folder (GET /me/mailFolders/{folderId}/messages).",
        inputSchema: messageListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = messageListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            assertMailFolderAllowed(
              mailFolderAllowlist,
              parsed.data.mailFolderId,
              "Mail folder",
            );
            const nextLink = validateNextLinkInput(
              parsed.data.nextLink,
              graphHost,
              OUTLOOK_NEXT_LINK_SCOPES.messages,
              {
                kind: "mailFolder",
                resourceId: parsed.data.mailFolderId,
              },
            );
            const top = Math.min(parsed.data.pageSize, LIST_MAX_PAGE_SIZE);
            const raw = await options.client.listMessages({
              mailFolderId: parsed.data.mailFolderId,
              top,
              ...(nextLink !== undefined ? { nextLink } : {}),
              signal: context.signal,
            });
            const result = mapMessageListResponse(raw, graphHost);
            assertStructuredOutputWithinBudget(result);
            return result;
          } catch (error) {
            throw mapError(error, redact);
          }
        },
      }),

      defineTool({
        name: OUTLOOK_MESSAGE_GET_TOOL,
        description:
          "Gets a message with plain-text body (Prefer: outlook.body-content-type=text). Untrusted content.",
        inputSchema: messageGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = messageGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const raw = await options.client.getMessage({
              messageId: parsed.data.messageId,
              signal: context.signal,
            });
            const result = mapMessageGetResponse(raw);
            assertStructuredOutputWithinBudget(result);
            return result;
          } catch (error) {
            throw mapError(error, redact);
          }
        },
      }),

      defineTool({
        name: OUTLOOK_MESSAGE_SEARCH_TOOL,
        description:
          'Searches messages with bounded $search query (GET /me/messages?$search="...").',
        inputSchema: messageSearchInputJsonSchema,
        handler: async (input, context) => {
          const parsed = messageSearchInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const nextLink = validateNextLinkInput(
              parsed.data.nextLink,
              graphHost,
              OUTLOOK_NEXT_LINK_SCOPES.messages,
            );
            const top = Math.min(parsed.data.pageSize, LIST_MAX_PAGE_SIZE);
            const raw = await options.client.searchMessages({
              query: parsed.data.query,
              top,
              ...(nextLink !== undefined ? { nextLink } : {}),
              signal: context.signal,
            });
            const result = mapMessageListResponse(raw, graphHost);
            assertStructuredOutputWithinBudget(result);
            return result;
          } catch (error) {
            throw mapError(error, redact);
          }
        },
      }),

      defineTool({
        name: OUTLOOK_CALENDAR_LIST_TOOL,
        description: "Lists calendars (GET /me/calendars).",
        inputSchema: calendarListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = calendarListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const nextLink = validateNextLinkInput(
              parsed.data.nextLink,
              graphHost,
              OUTLOOK_NEXT_LINK_SCOPES.calendars,
            );
            const top = Math.min(parsed.data.pageSize, LIST_MAX_PAGE_SIZE);
            const raw = await options.client.listCalendars({
              top,
              ...(nextLink !== undefined ? { nextLink } : {}),
              signal: context.signal,
            });
            const mapped = mapCalendarListResponse(raw, graphHost);
            const filtered = filterByCalendarAllowlist(
              calendarAllowlist,
              mapped.calendars,
              (c) => c.id,
            );
            const packed = packListWithinOutputBudget(
              {
                ...(mapped.nextLink !== undefined
                  ? { nextLink: mapped.nextLink }
                  : {}),
                untrustedContent: true as const,
              },
              "calendars",
              filtered,
            );
            assertStructuredOutputWithinBudget(packed);
            return packed;
          } catch (error) {
            throw mapError(error, redact);
          }
        },
      }),

      defineTool({
        name: OUTLOOK_EVENT_LIST_TOOL,
        description: "Lists calendar events (GET /me/calendars/{id}/events).",
        inputSchema: eventListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = eventListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            assertCalendarAllowed(
              calendarAllowlist,
              parsed.data.calendarId,
              "Calendar",
            );
            const nextLink = validateNextLinkInput(
              parsed.data.nextLink,
              graphHost,
              OUTLOOK_NEXT_LINK_SCOPES.events,
              {
                kind: "calendar",
                resourceId: parsed.data.calendarId,
              },
            );
            const top = Math.min(parsed.data.pageSize, LIST_MAX_PAGE_SIZE);
            const raw = await options.client.listEvents({
              calendarId: parsed.data.calendarId,
              top,
              ...(nextLink !== undefined ? { nextLink } : {}),
              signal: context.signal,
            });
            const result = mapEventListResponse(raw, graphHost);
            assertStructuredOutputWithinBudget(result);
            return result;
          } catch (error) {
            throw mapError(error, redact);
          }
        },
      }),

      defineTool({
        name: OUTLOOK_EVENT_GET_TOOL,
        description: "Gets a calendar event (GET /me/events/{id}).",
        inputSchema: eventGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = eventGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const raw = await options.client.getEvent({
              eventId: parsed.data.eventId,
              signal: context.signal,
            });
            const result = mapEventGetResponse(raw);
            assertStructuredOutputWithinBudget(result);
            return result;
          } catch (error) {
            throw mapError(error, redact);
          }
        },
      }),

      defineTool({
        name: OUTLOOK_MESSAGE_SEND_TOOL,
        description:
          "Sends mail (POST /me/sendMail, 202 Accepted). Requires OSVA_CONNECTOR_OUTLOOK_SEND_ENABLED, OSVA_CONNECTOR_OUTLOOK_HOST_SEND_APPROVED, and allowlisted recipients. Non-idempotent — not retried automatically.",
        inputSchema: messageSendInputJsonSchema,
        handler: async (input, context) => {
          const parsed = messageSendInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            assertSendEnabledAndApproved(config);
            assertRecipientsAllowedByHostPolicy(
              collectRecipientEmails(parsed.data.message),
              config,
            );
            const payload = buildGraphSendMailPayload({
              to: parsed.data.message.to,
              ...(parsed.data.message.cc !== undefined
                ? { cc: parsed.data.message.cc }
                : {}),
              ...(parsed.data.message.bcc !== undefined
                ? { bcc: parsed.data.message.bcc }
                : {}),
              subject: parsed.data.message.subject,
              bodyPlain: parsed.data.message.bodyPlain,
            });
            await options.client.sendMail({
              body: payload,
              signal: context.signal,
            });
            const result = mapSendMailResponse();
            assertStructuredOutputWithinBudget(result);
            return result;
          } catch (error) {
            throw mapError(error, redact, true);
          }
        },
      }),

      defineTool({
        name: OUTLOOK_EVENT_CREATE_TOOL,
        description:
          "Creates a calendar event (POST /me/calendars/{calendarId}/events). Requires write flags and host approval.",
        inputSchema: eventCreateInputJsonSchema,
        handler: async (input, context) => {
          const parsed = eventCreateInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            assertWritesEnabledAndApproved(config);
            assertCalendarMutationsAllowlistReady(calendarAllowlist);
            assertCalendarAllowed(
              calendarAllowlist,
              parsed.data.calendarId,
              "Calendar",
            );
            const eventBody: Record<string, unknown> = {
              subject: parsed.data.subject,
              start: {
                dateTime: parsed.data.start,
                timeZone: "UTC",
              },
              end: {
                dateTime: parsed.data.end,
                timeZone: "UTC",
              },
            };
            if (parsed.data.bodyPlain !== undefined) {
              eventBody.body = {
                contentType: "Text",
                content: parsed.data.bodyPlain,
              };
            }
            if (parsed.data.location !== undefined) {
              eventBody.location = { displayName: parsed.data.location };
            }
            const raw = await options.client.createEvent({
              calendarId: parsed.data.calendarId,
              body: eventBody,
              signal: context.signal,
            });
            const result = mapEventCreateResponse(raw);
            assertStructuredOutputWithinBudget(result);
            return { ...result, writeNotRetried: true as const };
          } catch (error) {
            throw mapError(error, redact, true);
          }
        },
      }),
    ],
  });
}
