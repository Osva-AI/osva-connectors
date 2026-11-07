import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { MAX_EVENT_NAME_LENGTH } from "./constants.js";

const EVENT_NAME_PATTERN = /^[\w $:\-]+$/;

export function validateEventName(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_EVENT_NAME_LENGTH) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Mixpanel event name is invalid.",
    );
  }
  if (trimmed.includes("\n") || trimmed.includes("\r")) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Mixpanel event name is invalid.",
    );
  }
  if (!EVENT_NAME_PATTERN.test(trimmed)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Mixpanel event name is invalid.",
    );
  }
  return trimmed;
}
