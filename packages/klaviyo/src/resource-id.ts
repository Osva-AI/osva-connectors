import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { MAX_RESOURCE_ID_LENGTH } from "./constants.js";

const KLAVIYO_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function parseKlaviyoResourceId(raw: string, label: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_RESOURCE_ID_LENGTH) {
    throw new ConnectorSdkError("INVALID_INPUT", `${label} is not valid.`);
  }
  if (!KLAVIYO_ID_PATTERN.test(trimmed)) {
    throw new ConnectorSdkError("INVALID_INPUT", `${label} is not valid.`);
  }
  return trimmed;
}
