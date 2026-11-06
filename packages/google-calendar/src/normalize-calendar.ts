import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  truncateUnicodeByCodePoints,
} from "./output-budget.js";

const MAX_DESCRIPTION_DISPLAY = 8_192;

export function mapCalendarListResponse(raw: unknown): {
  calendars: {
    id: string;
    summary?: string;
    timeZone?: string;
    accessRole?: string;
    selected?: boolean;
    primary?: boolean;
  }[];
  nextPageToken?: string;
  untrustedContent: true;
} {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Google Calendar returned an unexpected calendar list.",
    );
  }
  const r = raw as Record<string, unknown>;
  const items = r.items;
  const calendars: {
    id: string;
    summary?: string;
    timeZone?: string;
    accessRole?: string;
    selected?: boolean;
    primary?: boolean;
  }[] = [];
  if (Array.isArray(items)) {
    for (const item of items) {
      if (item === null || typeof item !== "object") {
        continue;
      }
      const c = item as Record<string, unknown>;
      const id = optionalString(c.id);
      if (id === undefined) {
        continue;
      }
      const entry: {
        id: string;
        summary?: string;
        timeZone?: string;
        accessRole?: string;
        selected?: boolean;
        primary?: boolean;
      } = { id };
      const summary = optionalTrimmedString(c.summary);
      if (summary !== undefined) {
        entry.summary = summary;
      }
      const timeZone = optionalString(c.timeZone);
      if (timeZone !== undefined) {
        entry.timeZone = timeZone;
      }
      const accessRole = optionalString(c.accessRole);
      if (accessRole !== undefined) {
        entry.accessRole = accessRole;
      }
      if (typeof c.selected === "boolean") {
        entry.selected = c.selected;
      }
      if (typeof c.primary === "boolean") {
        entry.primary = c.primary;
      }
      calendars.push(entry);
    }
  }
  const nextPageToken = optionalString(r.nextPageToken);
  return {
    calendars,
    ...(nextPageToken !== undefined ? { nextPageToken } : {}),
    untrustedContent: true as const,
  };
}

export function mapEventListResponse(raw: unknown): {
  events: ReturnType<typeof mapEventSummary>[];
  nextPageToken?: string;
  timeZonePropagationWarnings?: unknown;
  untrustedContent: true;
} {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Google Calendar returned an unexpected event list.",
    );
  }
  const r = raw as Record<string, unknown>;
  const items = r.items;
  const events: ReturnType<typeof mapEventSummary>[] = [];
  if (Array.isArray(items)) {
    for (const item of items) {
      events.push(mapEventSummary(item));
    }
  }
  const nextPageToken = optionalString(r.nextPageToken);
  const warnings = r.timeZonePropagationWarnings;
  return {
    events,
    ...(nextPageToken !== undefined ? { nextPageToken } : {}),
    ...(warnings !== undefined
      ? { timeZonePropagationWarnings: warnings }
      : {}),
    untrustedContent: true as const,
  };
}

export function mapEventGetResponse(raw: unknown): Record<string, unknown> {
  return mapEventDetail(raw);
}

export function mapFreeBusyResponse(raw: unknown): {
  calendars: unknown;
  untrustedContent: true;
} {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Google Calendar returned an unexpected freeBusy response.",
    );
  }
  return {
    calendars: (raw as Record<string, unknown>).calendars,
    untrustedContent: true as const,
  };
}

function mapEventSummary(raw: unknown): Record<string, unknown> {
  const detail = mapEventDetail(raw);
  const out: Record<string, unknown> = {
    id: detail.id,
    status: detail.status,
    untrustedContent: true as const,
  };
  if (detail.summary !== undefined) {
    out.summary = detail.summary;
  }
  if (detail.start !== undefined) {
    out.start = detail.start;
  }
  if (detail.end !== undefined) {
    out.end = detail.end;
  }
  if (detail.recurringEventId !== undefined) {
    out.recurringEventId = detail.recurringEventId;
  }
  if (detail.recurrence !== undefined) {
    out.recurrence = detail.recurrence;
  }
  if (detail.originalStartTime !== undefined) {
    out.originalStartTime = detail.originalStartTime;
  }
  return out;
}

function mapEventDetail(raw: unknown): Record<string, unknown> {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Google Calendar returned an unexpected event.",
    );
  }
  const e = raw as Record<string, unknown>;
  const id = requireShortString(e.id, "id");
  const out: Record<string, unknown> = {
    id,
    untrustedContent: true as const,
  };
  const status = optionalString(e.status);
  if (status !== undefined) {
    out.status = status;
  }
  const summary = optionalTrimmedString(e.summary);
  if (summary !== undefined) {
    out.summary = summary;
  }
  const location = optionalTrimmedString(e.location);
  if (location !== undefined) {
    out.location = location;
  }
  const description = redactLongOptional(e.description);
  if (description !== undefined) {
    out.description = description;
  }
  if (e.start !== undefined) {
    out.start = e.start;
  }
  if (e.end !== undefined) {
    out.end = e.end;
  }
  const recurringEventId = optionalString(e.recurringEventId);
  if (recurringEventId !== undefined) {
    out.recurringEventId = recurringEventId;
  }
  if (e.recurrence !== undefined) {
    out.recurrence = e.recurrence;
  }
  if (e.originalStartTime !== undefined) {
    out.originalStartTime = e.originalStartTime;
  }
  if (e.organizer !== undefined) {
    out.organizer = sanitizePerson(e.organizer);
  }
  if (Array.isArray(e.attendees)) {
    out.attendees = e.attendees.map((a) => sanitizePerson(a));
  }
  if (e.iCalUID !== undefined && typeof e.iCalUID === "string") {
    out.iCalUID = requireShortString(e.iCalUID, "iCalUID");
  }
  const hangoutLink = optionalString(e.hangoutLink);
  if (hangoutLink !== undefined) {
    out.hangoutLink = hangoutLink;
  }
  return out;
}

function sanitizePerson(raw: unknown): unknown {
  if (raw === null || typeof raw !== "object") {
    return raw;
  }
  const p = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  if (typeof p.email === "string") {
    out.email = truncateUnicodeByCodePoints(
      p.email,
      OUTPUT_MAX_PROVIDER_STRING_LENGTH,
    ).value;
  }
  if (typeof p.displayName === "string") {
    out.displayName = truncateUnicodeByCodePoints(
      p.displayName,
      OUTPUT_MAX_PROVIDER_STRING_LENGTH,
    ).value;
  }
  if (typeof p.responseStatus === "string") {
    out.responseStatus = p.responseStatus;
  }
  if (typeof p.optional === "boolean") {
    out.optional = p.optional;
  }
  if (typeof p.organizer === "boolean") {
    out.organizer = p.organizer;
  }
  return out;
}

function requireShortString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new ConnectorSdkError("PROVIDER_ERROR", `Missing ${label}.`);
  }
  if ([...value].length > OUTPUT_MAX_PROVIDER_STRING_LENGTH) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Response exceeds size limits.",
    );
  }
  return value;
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }
  return value;
}

function optionalTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const t = value.trim();
  if (t.length === 0) {
    return undefined;
  }
  return truncateUnicodeByCodePoints(t, OUTPUT_MAX_PROVIDER_STRING_LENGTH)
    .value;
}

function redactLongOptional(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }
  return truncateUnicodeByCodePoints(value, MAX_DESCRIPTION_DISPLAY).value;
}
