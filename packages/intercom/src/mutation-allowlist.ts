import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import {
  INTERCOM_STATE_CLOSED,
  INTERCOM_STATE_OPEN,
  LIST_DEFAULT_PAGE,
  MAX_NOTE_BODY_LENGTH,
  MAX_SEARCH_STARTING_AFTER_LENGTH,
} from "./constants.js";

export interface IntercomSearchPaginationInput {
  readonly page?: number;
  readonly startingAfter?: string;
}

const STATE_ALIASES: Record<string, string> = {
  open: INTERCOM_STATE_OPEN,
  closed: INTERCOM_STATE_CLOSED,
};

export function buildIntercomStateBody(
  state: string,
  adminId: string,
  allowedTargets: string[] | undefined,
): Record<string, unknown> {
  const permitted =
    allowedTargets === undefined
      ? new Set([INTERCOM_STATE_OPEN, INTERCOM_STATE_CLOSED, "open", "closed"])
      : new Set(allowedTargets.map((s) => s.toLowerCase()));
  const normalized = state.trim().toLowerCase();
  const resolved = STATE_ALIASES[normalized] ?? normalized;
  if (
    !permitted.has(state) &&
    !permitted.has(normalized) &&
    !permitted.has(resolved)
  ) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Conversation state is not an allowed target.",
    );
  }
  if (resolved !== INTERCOM_STATE_OPEN && resolved !== INTERCOM_STATE_CLOSED) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Conversation state must be open or closed.",
    );
  }
  const messageType = resolved === INTERCOM_STATE_OPEN ? "open" : "close";
  return {
    message_type: messageType,
    type: "admin",
    admin_id: adminId,
  };
}

function resolveIntercomSearchPagination(
  pagination: IntercomSearchPaginationInput,
): { page: number; startingAfter?: string } {
  const page = pagination.page ?? LIST_DEFAULT_PAGE;
  const startingAfter = pagination.startingAfter?.trim();

  if (startingAfter !== undefined && startingAfter.length === 0) {
    throw new ConnectorSdkError("INVALID_INPUT", "startingAfter is invalid.");
  }
  if (
    startingAfter !== undefined &&
    startingAfter.length > MAX_SEARCH_STARTING_AFTER_LENGTH
  ) {
    throw new ConnectorSdkError("INVALID_INPUT", "startingAfter is invalid.");
  }
  if (page > 1 && (startingAfter === undefined || startingAfter.length === 0)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Intercom search pagination beyond the first page requires startingAfter from a prior response.",
    );
  }
  if (
    startingAfter !== undefined &&
    startingAfter.length > 0 &&
    page !== LIST_DEFAULT_PAGE
  ) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "startingAfter cannot be combined with page greater than 1.",
    );
  }

  return {
    page,
    ...(startingAfter !== undefined && startingAfter.length > 0
      ? { startingAfter }
      : {}),
  };
}

export function buildIntercomConversationSearchBody(
  queryText: string,
  pagination: IntercomSearchPaginationInput,
): Record<string, unknown> {
  const resolved = resolveIntercomSearchPagination(pagination);
  return {
    query: {
      field: "source.body",
      operator: "~",
      value: queryText,
    },
    pagination: {
      per_page: 20,
      ...(resolved.startingAfter !== undefined
        ? { starting_after: resolved.startingAfter }
        : {}),
    },
  };
}

export function buildIntercomContactSearchBody(
  queryText: string,
  pagination: IntercomSearchPaginationInput,
): Record<string, unknown> {
  const resolved = resolveIntercomSearchPagination(pagination);
  return {
    query: {
      field: "name",
      operator: "~",
      value: queryText,
    },
    pagination: {
      per_page: 20,
      ...(resolved.startingAfter !== undefined
        ? { starting_after: resolved.startingAfter }
        : {}),
    },
  };
}

export function buildIntercomAdminNoteBody(
  adminId: string,
  body: string,
): Record<string, unknown> {
  const trimmed = body.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_NOTE_BODY_LENGTH) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Note body length is invalid.",
    );
  }
  return {
    message_type: "note",
    type: "admin",
    admin_id: adminId,
    body: trimmed,
  };
}
