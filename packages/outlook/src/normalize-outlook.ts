import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { GRAPH_API_HOST } from "./constants.js";
import { extractODataNextLink } from "./graph-pagination.js";
import {
  normalizeTruncatableProviderString,
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
} from "./output-budget.js";

const MAX_BODY_DISPLAY = 32_768;
const MAX_SUBJECT_DISPLAY = 998;

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function requireString(value: unknown, field: string): string {
  const s = optionalString(value);
  if (s === undefined) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      `Microsoft Graph returned unexpected ${field}.`,
    );
  }
  return s;
}

function redactOptionalLongString(
  value: unknown,
  maxCodePoints: number,
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const { value: trimmed, truncated } = normalizeTruncatableProviderString(
    value,
    maxCodePoints,
  );
  if (truncated) {
    return `${trimmed}…`;
  }
  return trimmed;
}

export function mapMailFolderListResponse(
  raw: unknown,
  graphApiHost: string = GRAPH_API_HOST,
): {
  mailFolders: { id: string; displayName?: string; parentFolderId?: string }[];
  nextLink?: string;
  untrustedContent: true;
} {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Microsoft Graph returned an unexpected mail folder list.",
    );
  }
  const r = raw as Record<string, unknown>;
  const values = r.value;
  const out: {
    id: string;
    displayName?: string;
    parentFolderId?: string;
  }[] = [];
  if (Array.isArray(values)) {
    for (const item of values) {
      if (item === null || typeof item !== "object") {
        continue;
      }
      const f = item as Record<string, unknown>;
      const id = optionalString(f.id);
      if (id === undefined) {
        continue;
      }
      const entry: {
        id: string;
        displayName?: string;
        parentFolderId?: string;
      } = { id };
      const displayName = redactOptionalLongString(
        f.displayName,
        OUTPUT_MAX_PROVIDER_STRING_LENGTH,
      );
      if (displayName !== undefined) {
        entry.displayName = displayName;
      }
      const parentFolderId = optionalString(f.parentFolderId);
      if (parentFolderId !== undefined) {
        entry.parentFolderId = parentFolderId;
      }
      out.push(entry);
    }
  }
  const nextLink = extractODataNextLink(raw, graphApiHost);
  return {
    mailFolders: out,
    ...(nextLink !== undefined ? { nextLink } : {}),
    untrustedContent: true as const,
  };
}

export function mapMessageListResponse(
  raw: unknown,
  graphApiHost: string = GRAPH_API_HOST,
): {
  messages: {
    id: string;
    subject?: string;
    receivedDateTime?: string;
    from?: string;
  }[];
  nextLink?: string;
  untrustedContent: true;
} {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Microsoft Graph returned an unexpected message list.",
    );
  }
  const r = raw as Record<string, unknown>;
  const values = r.value;
  const out: {
    id: string;
    subject?: string;
    receivedDateTime?: string;
    from?: string;
  }[] = [];
  if (Array.isArray(values)) {
    for (const item of values) {
      if (item === null || typeof item !== "object") {
        continue;
      }
      const m = item as Record<string, unknown>;
      const id = optionalString(m.id);
      if (id === undefined) {
        continue;
      }
      const entry: {
        id: string;
        subject?: string;
        receivedDateTime?: string;
        from?: string;
      } = { id };
      const subject = redactOptionalLongString(m.subject, MAX_SUBJECT_DISPLAY);
      if (subject !== undefined) {
        entry.subject = subject;
      }
      const received = optionalString(m.receivedDateTime);
      if (received !== undefined) {
        entry.receivedDateTime = received;
      }
      const from = extractFromAddress(m.from);
      if (from !== undefined) {
        entry.from = from;
      }
      out.push(entry);
    }
  }
  const nextLink = extractODataNextLink(raw, graphApiHost);
  return {
    messages: out,
    ...(nextLink !== undefined ? { nextLink } : {}),
    untrustedContent: true as const,
  };
}

function extractFromAddress(from: unknown): string | undefined {
  if (from === null || typeof from !== "object") {
    return undefined;
  }
  const emailAddress = (from as Record<string, unknown>).emailAddress;
  if (emailAddress === null || typeof emailAddress !== "object") {
    return undefined;
  }
  const address = (emailAddress as Record<string, unknown>).address;
  return optionalString(address);
}

export function mapMessageGetResponse(raw: unknown): {
  id: string;
  subject?: string;
  bodyText?: string;
  from?: string;
  toRecipients?: string[];
  receivedDateTime?: string;
  untrustedContent: true;
} {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Microsoft Graph returned an unexpected message.",
    );
  }
  const m = raw as Record<string, unknown>;
  const id = requireString(m.id, "message id");
  const entry: {
    id: string;
    subject?: string;
    bodyText?: string;
    from?: string;
    toRecipients?: string[];
    receivedDateTime?: string;
    untrustedContent: true;
  } = { id, untrustedContent: true as const };

  const subject = redactOptionalLongString(m.subject, MAX_SUBJECT_DISPLAY);
  if (subject !== undefined) {
    entry.subject = subject;
  }
  const body = m.body;
  if (body !== null && typeof body === "object") {
    const content = (body as Record<string, unknown>).content;
    const bodyText = redactOptionalLongString(content, MAX_BODY_DISPLAY);
    if (bodyText !== undefined) {
      entry.bodyText = bodyText;
    }
  }
  const from = extractFromAddress(m.from);
  if (from !== undefined) {
    entry.from = from;
  }
  const toRecipients = extractRecipientList(m.toRecipients);
  if (toRecipients.length > 0) {
    entry.toRecipients = toRecipients;
  }
  const received = optionalString(m.receivedDateTime);
  if (received !== undefined) {
    entry.receivedDateTime = received;
  }
  return entry;
}

function extractRecipientList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const out: string[] = [];
  for (const item of value) {
    if (item === null || typeof item !== "object") {
      continue;
    }
    const emailAddress = (item as Record<string, unknown>).emailAddress;
    if (emailAddress === null || typeof emailAddress !== "object") {
      continue;
    }
    const address = optionalString(
      (emailAddress as Record<string, unknown>).address,
    );
    if (address !== undefined) {
      out.push(address);
    }
  }
  return out;
}

export function mapCalendarListResponse(
  raw: unknown,
  graphApiHost: string = GRAPH_API_HOST,
): {
  calendars: { id: string; name?: string }[];
  nextLink?: string;
  untrustedContent: true;
} {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Microsoft Graph returned an unexpected calendar list.",
    );
  }
  const r = raw as Record<string, unknown>;
  const values = r.value;
  const out: { id: string; name?: string }[] = [];
  if (Array.isArray(values)) {
    for (const item of values) {
      if (item === null || typeof item !== "object") {
        continue;
      }
      const c = item as Record<string, unknown>;
      const id = optionalString(c.id);
      if (id === undefined) {
        continue;
      }
      const entry: { id: string; name?: string } = { id };
      const name = redactOptionalLongString(
        c.name,
        OUTPUT_MAX_PROVIDER_STRING_LENGTH,
      );
      if (name !== undefined) {
        entry.name = name;
      }
      out.push(entry);
    }
  }
  const nextLink = extractODataNextLink(raw, graphApiHost);
  return {
    calendars: out,
    ...(nextLink !== undefined ? { nextLink } : {}),
    untrustedContent: true as const,
  };
}

export function mapEventListResponse(
  raw: unknown,
  graphApiHost: string = GRAPH_API_HOST,
): {
  events: {
    id: string;
    subject?: string;
    start?: string;
    end?: string;
  }[];
  nextLink?: string;
  untrustedContent: true;
} {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Microsoft Graph returned an unexpected event list.",
    );
  }
  const r = raw as Record<string, unknown>;
  const values = r.value;
  const out: {
    id: string;
    subject?: string;
    start?: string;
    end?: string;
  }[] = [];
  if (Array.isArray(values)) {
    for (const item of values) {
      if (item === null || typeof item !== "object") {
        continue;
      }
      const e = item as Record<string, unknown>;
      const id = optionalString(e.id);
      if (id === undefined) {
        continue;
      }
      const entry: {
        id: string;
        subject?: string;
        start?: string;
        end?: string;
      } = { id };
      const subject = redactOptionalLongString(e.subject, MAX_SUBJECT_DISPLAY);
      if (subject !== undefined) {
        entry.subject = subject;
      }
      const start = extractDateTime(e.start);
      if (start !== undefined) {
        entry.start = start;
      }
      const end = extractDateTime(e.end);
      if (end !== undefined) {
        entry.end = end;
      }
      out.push(entry);
    }
  }
  const nextLink = extractODataNextLink(raw, graphApiHost);
  return {
    events: out,
    ...(nextLink !== undefined ? { nextLink } : {}),
    untrustedContent: true as const,
  };
}

function extractDateTime(value: unknown): string | undefined {
  if (value === null || typeof value !== "object") {
    return undefined;
  }
  return optionalString((value as Record<string, unknown>).dateTime);
}

export function mapEventGetResponse(raw: unknown): {
  id: string;
  subject?: string;
  start?: string;
  end?: string;
  location?: string;
  bodyText?: string;
  untrustedContent: true;
} {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Microsoft Graph returned an unexpected event.",
    );
  }
  const e = raw as Record<string, unknown>;
  const id = requireString(e.id, "event id");
  const entry: {
    id: string;
    subject?: string;
    start?: string;
    end?: string;
    location?: string;
    bodyText?: string;
    untrustedContent: true;
  } = { id, untrustedContent: true as const };

  const subject = redactOptionalLongString(e.subject, MAX_SUBJECT_DISPLAY);
  if (subject !== undefined) {
    entry.subject = subject;
  }
  const start = extractDateTime(e.start);
  if (start !== undefined) {
    entry.start = start;
  }
  const end = extractDateTime(e.end);
  if (end !== undefined) {
    entry.end = end;
  }
  const location = e.location;
  if (location !== null && typeof location === "object") {
    const displayName = redactOptionalLongString(
      (location as Record<string, unknown>).displayName,
      OUTPUT_MAX_PROVIDER_STRING_LENGTH,
    );
    if (displayName !== undefined) {
      entry.location = displayName;
    }
  }
  const body = e.body;
  if (body !== null && typeof body === "object") {
    const content = (body as Record<string, unknown>).content;
    const bodyText = redactOptionalLongString(content, MAX_BODY_DISPLAY);
    if (bodyText !== undefined) {
      entry.bodyText = bodyText;
    }
  }
  return entry;
}

export function mapSendMailResponse(): {
  accepted: true;
  status: 202;
  sendNotRetried: true;
} {
  return {
    accepted: true as const,
    status: 202 as const,
    sendNotRetried: true as const,
  };
}

export function mapEventCreateResponse(raw: unknown): {
  id: string;
  created: true;
} {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Microsoft Graph returned an unexpected event create response.",
    );
  }
  const id = requireString((raw as Record<string, unknown>).id, "event id");
  return { id, created: true as const };
}
