import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { MAX_RESOURCE_ID_LENGTH } from "./constants.js";

const HUBSPOT_ID_PATTERN = /^[0-9]{1,20}$/;

export function parseHubspotResourceId(raw: string, label: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_RESOURCE_ID_LENGTH) {
    throw new ConnectorSdkError("INVALID_INPUT", `${label} is not valid.`);
  }
  if (!HUBSPOT_ID_PATTERN.test(trimmed)) {
    throw new ConnectorSdkError("INVALID_INPUT", `${label} is not valid.`);
  }
  return trimmed;
}
