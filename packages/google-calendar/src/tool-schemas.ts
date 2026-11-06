import type { DefineToolOptions } from "@osva-ai/connector-sdk";
import { z } from "zod";

import {
  LIST_DEFAULT_PAGE_SIZE,
  LIST_MAX_PAGE_SIZE,
  MAX_CALENDAR_ID_LENGTH,
  MAX_FREEBUSY_ITEMS,
  MAX_PAGE_TOKEN_LENGTH,
  MAX_RESOURCE_ID_LENGTH,
  MAX_TIME_MAX_LENGTH,
} from "./constants.js";

const calendarIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_CALENDAR_ID_LENGTH)
  .refine((v) => !/[\0\r\n]/.test(v), "Invalid calendarId.");

const pageTokenSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_PAGE_TOKEN_LENGTH)
  .refine((value) => !/[\0\r\n]/.test(value), "Invalid pageToken.");

const eventIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_RESOURCE_ID_LENGTH)
  .refine((v) => !/[\0\r\n]/.test(v), "Invalid eventId.");

const rfc3339Schema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_TIME_MAX_LENGTH)
  .refine((v) => !/[\0\r\n]/.test(v), "Invalid time.");

function assertTimeMinBeforeMax(
  timeMin: string,
  timeMax: string,
  ctx: { addIssue: (issue: { code: "custom"; message: string }) => void },
): void {
  const a = Date.parse(timeMin);
  const b = Date.parse(timeMax);
  if (Number.isNaN(a) || Number.isNaN(b)) {
    ctx.addIssue({
      code: "custom",
      message: "timeMin and timeMax must be valid RFC 3339 timestamps.",
    });
    return;
  }
  if (a >= b) {
    ctx.addIssue({
      code: "custom",
      message: "timeMin must be strictly before timeMax.",
    });
  }
}

const timePointSchema = z
  .object({
    dateTime: rfc3339Schema.optional(),
    date: z.string().trim().min(1).max(32).optional(),
    timeZone: z.string().trim().max(128).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const hasDateTime = data.dateTime !== undefined;
    const hasDate = data.date !== undefined;
    if (hasDateTime === hasDate) {
      ctx.addIssue({
        code: "custom",
        message: "Specify exactly one of dateTime or date for each bound.",
      });
    }
  });

const attendeeSchema = z
  .object({
    email: z.string().trim().email().max(320),
  })
  .strict();

export const calendarListInputSchema = z
  .object({
    pageSize: z
      .number()
      .int()
      .min(1)
      .max(LIST_MAX_PAGE_SIZE)
      .optional()
      .default(LIST_DEFAULT_PAGE_SIZE),
    pageToken: pageTokenSchema.optional(),
  })
  .strict();

export const calendarListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    pageSize: { type: "integer", minimum: 1, maximum: LIST_MAX_PAGE_SIZE },
    pageToken: { type: "string" },
  },
} satisfies DefineToolOptions["inputSchema"];

export const eventListInputSchema = z
  .object({
    calendarId: calendarIdSchema,
    pageSize: z
      .number()
      .int()
      .min(1)
      .max(LIST_MAX_PAGE_SIZE)
      .optional()
      .default(LIST_DEFAULT_PAGE_SIZE),
    pageToken: pageTokenSchema.optional(),
    timeMin: rfc3339Schema.optional(),
    timeMax: rfc3339Schema.optional(),
    singleEvents: z.boolean().optional(),
    orderBy: z.enum(["startTime", "updated"]).optional(),
    q: z.string().trim().max(512).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.timeMin !== undefined && data.timeMax !== undefined) {
      assertTimeMinBeforeMax(data.timeMin, data.timeMax, ctx);
    }
  });

export const eventListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["calendarId"],
  properties: {
    calendarId: { type: "string" },
    pageSize: { type: "integer", minimum: 1, maximum: LIST_MAX_PAGE_SIZE },
    pageToken: { type: "string" },
    timeMin: { type: "string" },
    timeMax: { type: "string" },
    singleEvents: { type: "boolean" },
    orderBy: { type: "string", enum: ["startTime", "updated"] },
    q: { type: "string" },
  },
} satisfies DefineToolOptions["inputSchema"];

export const eventGetInputSchema = z
  .object({
    calendarId: calendarIdSchema,
    eventId: eventIdSchema,
  })
  .strict();

export const eventGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["calendarId", "eventId"],
  properties: {
    calendarId: { type: "string" },
    eventId: { type: "string" },
  },
} satisfies DefineToolOptions["inputSchema"];

export const freeBusyQueryInputSchema = z
  .object({
    timeMin: rfc3339Schema,
    timeMax: rfc3339Schema,
    items: z
      .array(
        z
          .object({
            id: calendarIdSchema,
          })
          .strict(),
      )
      .min(1)
      .max(MAX_FREEBUSY_ITEMS),
    timeZone: z.string().trim().max(128).optional(),
    calendarExpansionMax: z.number().int().min(1).max(500).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    assertTimeMinBeforeMax(data.timeMin, data.timeMax, ctx);
  });

export const freeBusyQueryInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["timeMin", "timeMax", "items"],
  properties: {
    timeMin: { type: "string" },
    timeMax: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id"],
        properties: { id: { type: "string" } },
      },
    },
    timeZone: { type: "string" },
    calendarExpansionMax: { type: "integer" },
  },
} satisfies DefineToolOptions["inputSchema"];

const sendUpdatesSchema = z.enum(["all", "externalOnly", "none"]);

const eventBodyBaseSchema = z
  .object({
    summary: z.string().trim().max(1024).optional(),
    description: z.string().max(8_192).optional(),
    location: z.string().trim().max(1024).optional(),
    start: timePointSchema,
    end: timePointSchema,
    attendees: z.array(attendeeSchema).max(50).optional(),
    recurrence: z.array(z.string().trim().max(512)).max(20).optional(),
    transparency: z.enum(["opaque", "transparent"]).optional(),
    guestsCanModify: z.boolean().optional(),
  })
  .strict();

export const eventCreateInputSchema = z
  .object({
    calendarId: calendarIdSchema,
    event: eventBodyBaseSchema,
    sendUpdates: sendUpdatesSchema.optional(),
  })
  .strict();

export const eventCreateInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["calendarId", "event"],
  properties: {
    calendarId: { type: "string" },
    sendUpdates: { type: "string", enum: ["all", "externalOnly", "none"] },
    event: { type: "object" },
  },
} satisfies DefineToolOptions["inputSchema"];

const eventPatchSchema = eventBodyBaseSchema.partial();

export const eventUpdateInputSchema = z
  .object({
    calendarId: calendarIdSchema,
    eventId: eventIdSchema,
    event: eventPatchSchema,
    sendUpdates: sendUpdatesSchema.optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const keys = Object.keys(data.event);
    if (keys.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "event patch must include at least one field.",
        path: ["event"],
      });
    }
  });

export const eventUpdateInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["calendarId", "eventId", "event"],
  properties: {
    calendarId: { type: "string" },
    eventId: { type: "string" },
    sendUpdates: { type: "string", enum: ["all", "externalOnly", "none"] },
    event: { type: "object" },
  },
} satisfies DefineToolOptions["inputSchema"];

export const eventDeleteInputSchema = z
  .object({
    calendarId: calendarIdSchema,
    eventId: eventIdSchema,
    sendUpdates: sendUpdatesSchema.optional(),
  })
  .strict();

export const eventDeleteInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["calendarId", "eventId"],
  properties: {
    calendarId: { type: "string" },
    eventId: { type: "string" },
    sendUpdates: { type: "string", enum: ["all", "externalOnly", "none"] },
  },
} satisfies DefineToolOptions["inputSchema"];

export function buildEventResourceBody(
  event: z.infer<typeof eventBodyBaseSchema>,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    start: stripUndefined(event.start),
    end: stripUndefined(event.end),
  };
  if (event.summary !== undefined) {
    body.summary = event.summary;
  }
  if (event.description !== undefined) {
    body.description = event.description;
  }
  if (event.location !== undefined) {
    body.location = event.location;
  }
  if (event.attendees !== undefined) {
    body.attendees = event.attendees;
  }
  if (event.recurrence !== undefined) {
    body.recurrence = event.recurrence;
  }
  if (event.transparency !== undefined) {
    body.transparency = event.transparency;
  }
  if (event.guestsCanModify !== undefined) {
    body.guestsCanModify = event.guestsCanModify;
  }
  return body;
}

export function buildEventPatchBody(
  event: z.infer<typeof eventPatchSchema>,
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (event.start !== undefined) {
    body.start = stripUndefined(event.start);
  }
  if (event.end !== undefined) {
    body.end = stripUndefined(event.end);
  }
  if (event.summary !== undefined) {
    body.summary = event.summary;
  }
  if (event.description !== undefined) {
    body.description = event.description;
  }
  if (event.location !== undefined) {
    body.location = event.location;
  }
  if (event.attendees !== undefined) {
    body.attendees = event.attendees;
  }
  if (event.recurrence !== undefined) {
    body.recurrence = event.recurrence;
  }
  if (event.transparency !== undefined) {
    body.transparency = event.transparency;
  }
  if (event.guestsCanModify !== undefined) {
    body.guestsCanModify = event.guestsCanModify;
  }
  return body;
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out = { ...obj };
  for (const k of Object.keys(out)) {
    if (out[k] === undefined) {
      delete out[k];
    }
  }
  return out;
}
