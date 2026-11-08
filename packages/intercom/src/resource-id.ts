import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { MAX_CONVERSATION_ID_LENGTH } from "./constants.js";

export function parseIntercomConversationId(
  value: string | number,
  label: string,
): string {
  const text = String(value).trim();
  if (text.length === 0 || text.length > MAX_CONVERSATION_ID_LENGTH) {
    throw new ConnectorSdkError("INVALID_INPUT", `${label} is invalid.`);
  }
  return text;
}

export function parseIntercomContactId(
  value: string | number,
  label: string,
): string {
  return parseIntercomConversationId(value, label);
}
