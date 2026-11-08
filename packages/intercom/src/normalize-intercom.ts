import {
  LIST_DEFAULT_PER_PAGE,
  OUTPUT_MAX_SUBJECT_LENGTH,
} from "./constants.js";

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}

function readString(
  obj: Record<string, unknown>,
  key: string,
): string | undefined {
  const v = obj[key];
  return typeof v === "string" ? v : undefined;
}

function readConversationId(raw: unknown): string {
  if (typeof raw !== "object" || raw === null) return "";
  const id = (raw as { id?: unknown }).id;
  return id === undefined ? "" : String(id);
}

function extractConversationArray(raw: unknown): unknown[] {
  if (
    typeof raw === "object" &&
    raw !== null &&
    Array.isArray((raw as { conversations?: unknown }).conversations)
  ) {
    return (raw as { conversations: unknown[] }).conversations;
  }
  if (
    typeof raw === "object" &&
    raw !== null &&
    Array.isArray((raw as { data?: unknown }).data)
  ) {
    return (raw as { data: unknown[] }).data;
  }
  return Array.isArray(raw) ? raw : [];
}

export function mapConversationListResponse(
  raw: unknown,
  page: number,
  includePii: boolean,
) {
  const conversations = extractConversationArray(raw).map((c) =>
    normalizeConversationSummary(c, includePii),
  );
  const nextPage =
    conversations.length >= LIST_DEFAULT_PER_PAGE ? page + 1 : undefined;
  return {
    pageInfo: {
      page,
      ...(nextPage !== undefined ? { nextPage } : { hasMore: false }),
    },
    conversations,
    untrustedContent: true as const,
  };
}

export function mapConversationGetResponse(raw: unknown, includePii: boolean) {
  const record =
    typeof raw === "object" && raw !== null
      ? (raw as Record<string, unknown>)
      : {};
  return {
    conversation: normalizeConversationSummary(record, includePii),
    untrustedContent: true as const,
  };
}

function normalizeConversationSummary(raw: unknown, includePii: boolean) {
  const row =
    typeof raw === "object" && raw !== null
      ? (raw as Record<string, unknown>)
      : {};
  return {
    id: readConversationId(row),
    state: readString(row, "state"),
    title: truncate(readString(row, "title") ?? "", OUTPUT_MAX_SUBJECT_LENGTH),
    createdAt: readString(row, "created_at"),
    updatedAt: readString(row, "updated_at"),
    ...(includePii ? {} : { piiRedacted: true as const }),
  };
}
