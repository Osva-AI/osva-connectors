import {
  ConnectorSdkError,
  defineConnector,
  defineTool,
  type DefinedConnector,
} from "@osva-ai/connector-sdk";

import {
  assertCalendarAllowed,
  createCalendarAllowlist,
} from "./calendar-allowlist.js";
import type { CalendarClient } from "./calendar-client.js";
import {
  CAL_CALENDAR_LIST_TOOL,
  CAL_EVENT_CREATE_TOOL,
  CAL_EVENT_DELETE_TOOL,
  CAL_EVENT_GET_TOOL,
  CAL_EVENT_LIST_TOOL,
  CAL_EVENT_UPDATE_TOOL,
  CAL_FREEBUSY_QUERY_TOOL,
  CONNECTOR_KEY,
  CONNECTOR_NAME,
  CONNECTOR_VERSION,
} from "./constants.js";
import { mapCalendarError } from "./map-calendar-error.js";
import {
  mapCalendarListResponse,
  mapEventGetResponse,
  mapEventListResponse,
  mapFreeBusyResponse,
} from "./normalize-calendar.js";
import { assertStructuredOutputWithinBudget } from "./output-budget.js";
import type { GoogleCalendarConfig } from "./schemas.js";
import {
  buildEventPatchBody,
  buildEventResourceBody,
  calendarListInputJsonSchema,
  calendarListInputSchema,
  eventCreateInputJsonSchema,
  eventCreateInputSchema,
  eventDeleteInputJsonSchema,
  eventDeleteInputSchema,
  eventGetInputJsonSchema,
  eventGetInputSchema,
  eventListInputJsonSchema,
  eventListInputSchema,
  eventUpdateInputJsonSchema,
  eventUpdateInputSchema,
  freeBusyQueryInputJsonSchema,
  freeBusyQueryInputSchema,
} from "./tool-schemas.js";

export interface CreateGoogleCalendarConnectorOptions {
  readonly client: CalendarClient;
  readonly config: GoogleCalendarConfig;
  readonly accessTokenForRedaction?: string;
}

function invalidInputError(): ConnectorSdkError {
  return new ConnectorSdkError("INVALID_INPUT", "Invalid tool input.");
}

function mapError(
  error: unknown,
  accessTokenForRedaction?: string,
  ambiguousMutation?: boolean,
): ConnectorSdkError {
  return mapCalendarError(error, {
    ...(accessTokenForRedaction !== undefined
      ? { accessToken: accessTokenForRedaction }
      : {}),
    ...(ambiguousMutation === true ? { ambiguousMutation: true } : {}),
  });
}

function assertWriteEnabled(config: GoogleCalendarConfig): void {
  if (!config.writeEnabled) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Google Calendar writes are disabled. Set OSVA_CONNECTOR_GOOGLE_CALENDAR_WRITE_ENABLED=true after host policy review.",
    );
  }
  if (!config.hostMutationsApproved) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Google Calendar mutations require explicit host approval. Set OSVA_CONNECTOR_GOOGLE_CALENDAR_HOST_MUTATIONS_APPROVED=true.",
    );
  }
}

export function createGoogleCalendarConnector(
  options: CreateGoogleCalendarConnectorOptions,
): DefinedConnector {
  const config = options.config;
  const allowlist = createCalendarAllowlist(config.allowedCalendarIds);
  const redact = options.accessTokenForRedaction;

  return defineConnector({
    key: CONNECTOR_KEY,
    name: CONNECTOR_NAME,
    description:
      "Google Calendar MCP connector for OSVA Connector Profile V1: calendar discovery, bounded event reads, free/busy query, and controlled event mutations when explicitly enabled and host-approved. Event text fields are untrusted. Recurring instances may appear as separate events when singleEvents is used. Hosts may restrict mutating tools to an allowlisted set of calendar IDs.",
    version: CONNECTOR_VERSION,
    tools: [
      defineTool({
        name: CAL_CALENDAR_LIST_TOOL,
        description:
          "Lists calendars visible to the credential (calendarList.list) with bounded pagination. When OSVA_CONNECTOR_GOOGLE_CALENDAR_ALLOWED_CALENDAR_IDS is set to a non-empty list, only those calendar ids are returned. When set to an empty value (explicit empty allowlist), no calendars are returned.",
        inputSchema: calendarListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = calendarListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const raw = await options.client.listCalendars({
              maxResults: parsed.data.pageSize,
              ...(parsed.data.pageToken !== undefined
                ? { pageToken: parsed.data.pageToken }
                : {}),
              signal: context.signal,
            });
            const result = mapCalendarListResponse(raw);
            if (allowlist !== undefined) {
              result.calendars = result.calendars.filter((c) =>
                allowlist.allowedIds.has(c.id),
              );
            }
            assertStructuredOutputWithinBudget(result);
            return result;
          } catch (error) {
            throw mapError(error, redact);
          }
        },
      }),

      defineTool({
        name: CAL_EVENT_LIST_TOOL,
        description:
          "Lists events in a calendar (events.list). Use time bounds; for recurring series, set singleEvents and orderBy=startTime. Untrusted text fields.",
        inputSchema: eventListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = eventListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            assertCalendarAllowed(
              allowlist,
              parsed.data.calendarId,
              "calendarId",
            );
            const raw = await options.client.listEvents({
              calendarId: parsed.data.calendarId,
              maxResults: parsed.data.pageSize,
              ...(parsed.data.pageToken !== undefined
                ? { pageToken: parsed.data.pageToken }
                : {}),
              ...(parsed.data.timeMin !== undefined
                ? { timeMin: parsed.data.timeMin }
                : {}),
              ...(parsed.data.timeMax !== undefined
                ? { timeMax: parsed.data.timeMax }
                : {}),
              ...(parsed.data.singleEvents === true
                ? { singleEvents: true }
                : {}),
              ...(parsed.data.orderBy !== undefined
                ? { orderBy: parsed.data.orderBy }
                : {}),
              ...(parsed.data.q !== undefined ? { q: parsed.data.q } : {}),
              signal: context.signal,
            });
            const result = mapEventListResponse(raw);
            assertStructuredOutputWithinBudget(result);
            return result;
          } catch (error) {
            throw mapError(error, redact);
          }
        },
      }),

      defineTool({
        name: CAL_EVENT_GET_TOOL,
        description:
          "Gets a single event (events.get). Summaries, descriptions, and attendee metadata are untrusted.",
        inputSchema: eventGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = eventGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            assertCalendarAllowed(
              allowlist,
              parsed.data.calendarId,
              "calendarId",
            );
            const raw = await options.client.getEvent({
              calendarId: parsed.data.calendarId,
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
        name: CAL_FREEBUSY_QUERY_TOOL,
        description:
          "Queries free/busy intervals (freeBusy). Pass bounded calendar id items (Calendar v3 freeBusy request body).",
        inputSchema: freeBusyQueryInputJsonSchema,
        handler: async (input, context) => {
          const parsed = freeBusyQueryInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            for (const item of parsed.data.items) {
              assertCalendarAllowed(allowlist, item.id, "freeBusy item id");
            }
            const body: Record<string, unknown> = {
              timeMin: parsed.data.timeMin,
              timeMax: parsed.data.timeMax,
              items: parsed.data.items.map((i) => ({ id: i.id })),
            };
            if (parsed.data.timeZone !== undefined) {
              body.timeZone = parsed.data.timeZone;
            }
            if (parsed.data.calendarExpansionMax !== undefined) {
              body.calendarExpansionMax = parsed.data.calendarExpansionMax;
            }
            const raw = await options.client.queryFreeBusy({
              body,
              signal: context.signal,
            });
            const result = mapFreeBusyResponse(raw);
            assertStructuredOutputWithinBudget(result);
            return result;
          } catch (error) {
            throw mapError(error, redact);
          }
        },
      }),

      defineTool({
        name: CAL_EVENT_CREATE_TOOL,
        description:
          "Creates an event (events.insert). Requires write enablement, host approval, and allowlisted calendarId. Side effects include invitations when sendUpdates=all.",
        inputSchema: eventCreateInputJsonSchema,
        handler: async (input, context) => {
          const parsed = eventCreateInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            assertWriteEnabled(config);
            assertCalendarAllowed(
              allowlist,
              parsed.data.calendarId,
              "calendarId",
            );
            const resource = buildEventResourceBody(parsed.data.event);
            const raw = await options.client.createEvent({
              calendarId: parsed.data.calendarId,
              body: resource,
              ...(parsed.data.sendUpdates !== undefined
                ? { sendUpdates: parsed.data.sendUpdates }
                : {}),
              signal: context.signal,
            });
            const result = mapEventGetResponse(raw);
            assertStructuredOutputWithinBudget(result);
            return { ...result, mutationNotRetried: true as const };
          } catch (error) {
            throw mapError(error, redact, true);
          }
        },
      }),

      defineTool({
        name: CAL_EVENT_UPDATE_TOOL,
        description:
          "Applies a partial update to an event (events.patch). Same policy as create. Recurrence and instance semantics follow Google Calendar.",
        inputSchema: eventUpdateInputJsonSchema,
        handler: async (input, context) => {
          const parsed = eventUpdateInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            assertWriteEnabled(config);
            assertCalendarAllowed(
              allowlist,
              parsed.data.calendarId,
              "calendarId",
            );
            const resource = buildEventPatchBody(parsed.data.event);
            const raw = await options.client.updateEvent({
              calendarId: parsed.data.calendarId,
              eventId: parsed.data.eventId,
              body: resource,
              ...(parsed.data.sendUpdates !== undefined
                ? { sendUpdates: parsed.data.sendUpdates }
                : {}),
              signal: context.signal,
            });
            const result = mapEventGetResponse(raw);
            assertStructuredOutputWithinBudget(result);
            return { ...result, mutationNotRetried: true as const };
          } catch (error) {
            throw mapError(error, redact, true);
          }
        },
      }),

      defineTool({
        name: CAL_EVENT_DELETE_TOOL,
        description:
          "Deletes an event (events.delete). sendUpdates controls attendee notifications. cancellation semantics follow Google Calendar for recurring events.",
        inputSchema: eventDeleteInputJsonSchema,
        handler: async (input, context) => {
          const parsed = eventDeleteInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            assertWriteEnabled(config);
            assertCalendarAllowed(
              allowlist,
              parsed.data.calendarId,
              "calendarId",
            );
            await options.client.deleteEvent({
              calendarId: parsed.data.calendarId,
              eventId: parsed.data.eventId,
              ...(parsed.data.sendUpdates !== undefined
                ? { sendUpdates: parsed.data.sendUpdates }
                : {}),
              signal: context.signal,
            });
            return {
              deleted: true as const,
              calendarId: parsed.data.calendarId,
              eventId: parsed.data.eventId,
              mutationNotRetried: true as const,
            };
          } catch (error) {
            throw mapError(error, redact, true);
          }
        },
      }),
    ],
  });
}
