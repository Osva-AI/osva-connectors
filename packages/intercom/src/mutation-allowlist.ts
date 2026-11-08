import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import {
  INTERCOM_STATE_CLOSED,
  INTERCOM_STATE_OPEN,
  MAX_NOTE_BODY_LENGTH,
} from "./constants.js";

const STATE_ALIASES: Record<string, string> = {
  open: INTERCOM_STATE_OPEN,
  closed: INTERCOM_STATE_CLOSED,
};

export function buildIntercomStateBody(
  state: string,
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
  return { open: resolved === INTERCOM_STATE_OPEN };
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
