import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import {
  FRESHDESK_STATUS_OPEN,
  FRESHDESK_STATUS_PENDING,
  FRESHDESK_STATUS_RESOLVED,
  MAX_NOTE_BODY_LENGTH,
} from "./constants.js";

const STATUS_NAME_TO_CODE: Record<string, number> = {
  open: FRESHDESK_STATUS_OPEN,
  pending: FRESHDESK_STATUS_PENDING,
  resolved: FRESHDESK_STATUS_RESOLVED,
  "2": FRESHDESK_STATUS_OPEN,
  "3": FRESHDESK_STATUS_PENDING,
  "4": FRESHDESK_STATUS_RESOLVED,
};

export function buildFreshdeskStatusBody(
  status: string,
  allowedTargets: string[] | undefined,
): Record<string, unknown> {
  const permitted =
    allowedTargets === undefined
      ? new Set(Object.keys(STATUS_NAME_TO_CODE))
      : new Set(allowedTargets);
  if (allowedTargets !== undefined && permitted.size === 0) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Ticket target status allowlist is explicitly empty.",
    );
  }
  const normalized = status.trim().toLowerCase();
  if (!permitted.has(status) && !permitted.has(normalized)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Ticket status is not an allowed target.",
    );
  }
  const code = STATUS_NAME_TO_CODE[normalized] ?? STATUS_NAME_TO_CODE[status];
  if (code === undefined) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Ticket status must be open, pending, resolved, or 2–4.",
    );
  }
  return { status: code };
}

export function buildFreshdeskPrivateNoteBody(
  body: string,
): Record<string, unknown> {
  const trimmed = body.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_NOTE_BODY_LENGTH) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Private note body length is invalid.",
    );
  }
  return { body: trimmed, private: true };
}
