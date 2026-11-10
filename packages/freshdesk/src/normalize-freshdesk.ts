import {
  CONVERSATIONS_PREVIEW_MAX,
  LIST_DEFAULT_PER_PAGE,
  OUTPUT_MAX_SUBJECT_LENGTH,
} from "./constants.js";

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}

function formatStatus(value: unknown): string | number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  return undefined;
}

function redactEmail(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  return "[REDACTED_EMAIL]";
}

export function mapTicketListResponse(
  raw: unknown,
  page: number,
  includePii: boolean,
) {
  const tickets = extractTicketArray(raw).map((ticket) =>
    normalizeTicketSummary(ticket, includePii),
  );
  const nextPage =
    tickets.length >= LIST_DEFAULT_PER_PAGE ? page + 1 : undefined;
  return {
    pageInfo: {
      page,
      ...(nextPage !== undefined ? { nextPage } : { hasMore: false }),
    },
    tickets,
    untrustedContent: true as const,
  };
}

export function mapTicketGetResponse(raw: unknown, includePii: boolean) {
  return {
    ticket: normalizeTicketDetail(raw, includePii),
    untrustedContent: true as const,
  };
}

export function mapCommentListResponse(raw: unknown, includePii: boolean) {
  const comments = extractCommentArray(raw)
    .slice(0, CONVERSATIONS_PREVIEW_MAX)
    .map((comment) => normalizeComment(comment, includePii));
  return { comments, untrustedContent: true as const };
}

export function mapUserGetResponse(raw: unknown, includePii: boolean) {
  const user = extractNestedUser(raw);
  return {
    user: normalizeUser(user, includePii),
    untrustedContent: true as const,
  };
}

export function mapOrganizationGetResponse(raw: unknown) {
  const organization = extractNestedOrganization(raw);
  return {
    organization: {
      id: readId(organization, "id"),
      name: truncate(readString(organization, "name") ?? "", 256),
    },
    untrustedContent: true as const,
  };
}

export function mapNoteCreateResponse(raw: unknown, ticketId: number) {
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

export function mapStatusUpdateResponse(raw: unknown, ticketId: number) {
  const ticket = extractNestedTicket(raw);
  return {
    ticketId,
    updated: true as const,
    status: formatStatus(ticket.status),
  };
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

function extractNestedOrganization(raw: unknown): Record<string, unknown> {
  if (
    typeof raw === "object" &&
    raw !== null &&
    typeof (raw as { organization?: unknown }).organization === "object"
  ) {
    return (raw as { organization: Record<string, unknown> }).organization;
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
  includePii: boolean,
): Record<string, unknown> {
  const ticket =
    typeof raw === "object" && raw !== null
      ? (raw as Record<string, unknown>)
      : {};
  return {
    id: readId(ticket, "id"),
    status: formatStatus(ticket.status),
    subject: truncate(
      readString(ticket, "subject") ?? "",
      OUTPUT_MAX_SUBJECT_LENGTH,
    ),
    createdAt: readString(ticket, "created_at"),
    updatedAt: readString(ticket, "updated_at"),
    requesterId: readId(ticket, "requester_id"),
    ...(includePii
      ? { requesterEmail: readString(ticket, "requester_email") }
      : {}),
  };
}

function normalizeTicketDetail(
  raw: unknown,
  includePii: boolean,
): Record<string, unknown> {
  const ticket = extractNestedTicket(raw);
  return {
    ...normalizeTicketSummary(ticket, includePii),
    priority: readString(ticket, "priority"),
    organizationId: readId(ticket, "organization_id"),
  };
}

const REDACTED_CUSTOMER_BODY = "[REDACTED_CUSTOMER_CONTENT]";
const REDACTED_PUBLIC_AGENT_REPLY = "[REDACTED_PUBLIC_REPLY]";

function readBoolean(value: unknown): boolean | undefined {
  if (value === true) {
    return true;
  }
  if (value === false) {
    return false;
  }
  return undefined;
}

/**
 * Freshdesk conversations use `private` and `incoming` (not Zendesk `public`).
 * Missing visibility metadata is treated as customer-facing (fail closed).
 */
function conversationBodyForOutput(
  record: Record<string, unknown>,
  includePii: boolean,
): { body: string; privateNote: boolean; incoming?: boolean } {
  const privateFlag = readBoolean(record.private);
  const incoming = readBoolean(record.incoming);
  const rawBody = readString(record, "body") ?? readString(record, "body_text");

  if (privateFlag === true) {
    return {
      privateNote: true,
      body: truncate(rawBody ?? "", 2_048),
      ...(incoming !== undefined ? { incoming } : {}),
    };
  }

  const customerFacing =
    incoming === true ||
    privateFlag === false ||
    (privateFlag === undefined && incoming === undefined);

  if (customerFacing && !includePii) {
    const isIncomingCustomer = incoming === true || incoming === undefined;
    const redacted = isIncomingCustomer
      ? REDACTED_CUSTOMER_BODY
      : REDACTED_PUBLIC_AGENT_REPLY;
    return {
      privateNote: false,
      body: redacted,
      ...(incoming !== undefined ? { incoming } : {}),
    };
  }

  return {
    privateNote: false,
    body: truncate(rawBody ?? "", 2_048),
    ...(incoming !== undefined ? { incoming } : {}),
  };
}

function normalizeComment(
  raw: unknown,
  includePii: boolean,
): Record<string, unknown> {
  const comment =
    typeof raw === "object" && raw !== null
      ? (raw as Record<string, unknown>)
      : {};
  const mapped = conversationBodyForOutput(comment, includePii);
  return {
    id: readId(comment, "id"),
    private: mapped.privateNote,
    createdAt: readString(comment, "created_at"),
    authorId: readId(comment, "user_id") ?? readId(comment, "author_id"),
    body: mapped.body,
    ...(mapped.incoming !== undefined ? { incoming: mapped.incoming } : {}),
    ...(includePii
      ? {
          authorEmail:
            redactEmail(comment.from_email) ??
            redactEmail(comment.author_email),
        }
      : {}),
  };
}

function normalizeUser(
  raw: Record<string, unknown>,
  includePii: boolean,
): Record<string, unknown> {
  return {
    id: readId(raw, "id"),
    name: truncate(readString(raw, "name") ?? "", 256),
    role: readString(raw, "role"),
    ...(includePii
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
