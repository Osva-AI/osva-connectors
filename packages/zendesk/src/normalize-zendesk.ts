import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import {
  COMMENTS_PREVIEW_MAX,
  OUTPUT_MAX_STATUS_LENGTH,
  OUTPUT_MAX_SUBJECT_LENGTH,
} from "./constants.js";

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}

function redactEmail(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  return "[REDACTED_EMAIL]";
}

export function mapTicketListResponse(
  raw: unknown,
  nextCursor: string | undefined,
  includeRequesterPii: boolean,
) {
  const tickets = extractTicketArray(raw).map((ticket) =>
    normalizeTicketSummary(ticket, includeRequesterPii),
  );
  return {
    pageInfo: {
      ...(nextCursor !== undefined
        ? { nextCursor, hasMore: true }
        : { hasMore: false }),
    },
    tickets,
    untrustedContent: true as const,
    indexingNote:
      "Zendesk list results use cursor pagination; continue with the opaque nextCursor when provided.",
  };
}

export function mapTicketSearchResponse(
  raw: unknown,
  page: number,
  includeRequesterPii: boolean,
) {
  const results = extractSearchResults(raw).map((entry) => {
    const ticket = extractNestedTicket(entry);
    return normalizeTicketSummary(ticket, includeRequesterPii);
  });
  return {
    page,
    tickets: results,
    untrustedContent: true as const,
    indexingNote:
      "Zendesk Search API results are eventually consistent and limited to the provider search window (max 1,000 results).",
  };
}

export function extractTicketUpdatedStamp(raw: unknown): string {
  const ticket = extractNestedTicket(raw);
  const stamp = readString(ticket, "updated_at");
  if (stamp === undefined || stamp.length === 0) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Ticket update timestamp missing from provider response.",
    );
  }
  return stamp;
}

export function mapTicketGetResponse(
  raw: unknown,
  includeRequesterPii: boolean,
) {
  return {
    ticket: normalizeTicketDetail(raw, includeRequesterPii),
    untrustedContent: true as const,
  };
}

export function mapCommentListResponse(
  raw: unknown,
  nextCursor: string | undefined,
  includeRequesterPii: boolean,
) {
  const comments = extractCommentArray(raw)
    .slice(0, COMMENTS_PREVIEW_MAX)
    .map((comment) => normalizeComment(comment, includeRequesterPii));
  return {
    comments,
    pageInfo: {
      ...(nextCursor !== undefined
        ? { nextCursor, hasMore: true }
        : { hasMore: false }),
    },
    untrustedContent: true as const,
  };
}

export function mapUserGetResponse(raw: unknown, includeRequesterPii: boolean) {
  const user = extractNestedUser(raw);
  return {
    user: normalizeUser(user, includeRequesterPii),
    untrustedContent: true as const,
  };
}

export function mapNoteAddResponse(raw: unknown, ticketId: number) {
  const record =
    typeof raw === "object" && raw !== null
      ? (raw as Record<string, unknown>)
      : {};
  return {
    ticketId,
    created: true as const,
    id: readId(record, "id"),
    internalNote: true as const,
  };
}

export function mapStatusSetResponse(raw: unknown, ticketId: number) {
  const ticket = extractNestedTicket(raw);
  return {
    ticketId,
    updated: true as const,
    status: truncate(
      readString(ticket, "status") ?? "",
      OUTPUT_MAX_STATUS_LENGTH,
    ),
  };
}

function extractSearchResults(raw: unknown): unknown[] {
  if (
    typeof raw === "object" &&
    raw !== null &&
    Array.isArray((raw as { results?: unknown }).results)
  ) {
    return (raw as { results: unknown[] }).results;
  }
  return [];
}

function extractTicketArray(raw: unknown): unknown[] {
  if (
    typeof raw === "object" &&
    raw !== null &&
    Array.isArray((raw as { tickets?: unknown }).tickets)
  ) {
    return (raw as { tickets: unknown[] }).tickets;
  }
  return Array.isArray(raw) ? raw : [];
}

function extractCommentArray(raw: unknown): unknown[] {
  if (
    typeof raw === "object" &&
    raw !== null &&
    Array.isArray((raw as { comments?: unknown }).comments)
  ) {
    return (raw as { comments: unknown[] }).comments;
  }
  return [];
}

function extractNestedUser(raw: unknown): Record<string, unknown> {
  if (
    typeof raw === "object" &&
    raw !== null &&
    typeof (raw as { user?: unknown }).user === "object"
  ) {
    return (raw as { user: Record<string, unknown> }).user;
  }
  return typeof raw === "object" && raw !== null
    ? (raw as Record<string, unknown>)
    : {};
}

function extractNestedTicket(raw: unknown): Record<string, unknown> {
  if (
    typeof raw === "object" &&
    raw !== null &&
    typeof (raw as { ticket?: unknown }).ticket === "object"
  ) {
    return (raw as { ticket: Record<string, unknown> }).ticket;
  }
  return typeof raw === "object" && raw !== null
    ? (raw as Record<string, unknown>)
    : {};
}

function normalizeTicketSummary(
  raw: unknown,
  includeRequesterPii: boolean,
): Record<string, unknown> {
  const ticket =
    typeof raw === "object" && raw !== null
      ? (raw as Record<string, unknown>)
      : {};
  return {
    id: readId(ticket, "id"),
    status: truncate(
      readString(ticket, "status") ?? "",
      OUTPUT_MAX_STATUS_LENGTH,
    ),
    subject: truncate(
      readString(ticket, "subject") ?? "",
      OUTPUT_MAX_SUBJECT_LENGTH,
    ),
    createdAt: readString(ticket, "created_at"),
    updatedAt: readString(ticket, "updated_at"),
    requesterId: readId(ticket, "requester_id"),
    ...(includeRequesterPii
      ? { requesterEmail: readString(ticket, "requester_email") }
      : {}),
  };
}

function normalizeTicketDetail(
  raw: unknown,
  includeRequesterPii: boolean,
): Record<string, unknown> {
  const ticket = extractNestedTicket(raw);
  return {
    ...normalizeTicketSummary(ticket, includeRequesterPii),
    priority: readString(ticket, "priority"),
    organizationId: readId(ticket, "organization_id"),
  };
}

function normalizeComment(
  raw: unknown,
  includeRequesterPii: boolean,
): Record<string, unknown> {
  const comment =
    typeof raw === "object" && raw !== null
      ? (raw as Record<string, unknown>)
      : {};
  const isPublic = comment.public === true;
  return {
    id: readId(comment, "id"),
    public: isPublic,
    createdAt: readString(comment, "created_at"),
    authorId: readId(comment, "author_id"),
    body: isPublic
      ? "[REDACTED_PUBLIC_COMMENT]"
      : truncate(readString(comment, "body") ?? "", 2_048),
    ...(includeRequesterPii
      ? { authorEmail: redactEmail(comment.author_email) }
      : {}),
  };
}

function normalizeUser(
  raw: Record<string, unknown>,
  includeRequesterPii: boolean,
): Record<string, unknown> {
  return {
    id: readId(raw, "id"),
    name: truncate(readString(raw, "name") ?? "", 256),
    role: readString(raw, "role"),
    ...(includeRequesterPii
      ? { email: readString(raw, "email") }
      : { email: redactEmail(raw.email) }),
  };
}

function readId(
  record: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = record[key];
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === "string" && value.length > 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) ? parsed : undefined;
  }
  return undefined;
}

function readString(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}
