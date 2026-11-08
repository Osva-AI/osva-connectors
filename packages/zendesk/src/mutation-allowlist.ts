import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { MAX_NOTE_BODY_LENGTH } from "./constants.js";

const DEFAULT_TICKET_STATUSES = new Set(["open", "pending", "hold", "solved"]);

export function buildZendeskTicketStatusBody(
  status: string,
  updatedStamp: string,
  allowedTargets: string[] | undefined,
): Record<string, unknown> {
  const permitted =
    allowedTargets === undefined
      ? DEFAULT_TICKET_STATUSES
      : new Set(allowedTargets);
  if (allowedTargets !== undefined && permitted.size === 0) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Ticket target status allowlist is explicitly empty.",
    );
  }
  if (typeof status !== "string" || !permitted.has(status)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Ticket status is not an allowed target.",
    );
  }
  return {
    ticket: {
      status,
      safe_update: true,
      updated_stamp: updatedStamp,
    },
  };
}

export function buildZendeskInternalNoteBody(
  body: string,
  updatedStamp: string,
): Record<string, unknown> {
  const trimmed = body.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_NOTE_BODY_LENGTH) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Internal note body length is invalid.",
    );
  }
  return {
    ticket: {
      comment: {
        body: trimmed,
        public: false,
      },
      safe_update: true,
      updated_stamp: updatedStamp,
    },
  };
}

export function buildZendeskSearchQuery(filters: {
  readonly status?: string;
  readonly updatedSince?: string;
}): string {
  const parts = ["type:ticket"];
  if (filters.status !== undefined) {
    parts.push(`status:${filters.status}`);
  }
  if (filters.updatedSince !== undefined) {
    parts.push(`updated>${filters.updatedSince}`);
  }
  const query = parts.join(" ");
  if (query.length > 512) {
    throw new ConnectorSdkError("INVALID_INPUT", "Search query is too long.");
  }
  return query;
}
