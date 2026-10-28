import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { MAX_RESOURCE_ID_LENGTH } from "./constants.js";

const STRIPE_ID_PATTERN = /^[A-Za-z0-9_]{1,255}$/;

export function parseStripeResourceId(raw: string, label: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_RESOURCE_ID_LENGTH) {
    throw new ConnectorSdkError("INVALID_INPUT", `${label} is not valid.`);
  }
  if (!STRIPE_ID_PATTERN.test(trimmed)) {
    throw new ConnectorSdkError("INVALID_INPUT", `${label} is not valid.`);
  }
  return trimmed;
}

export function parseStripeCustomerId(raw: string): string {
  const id = parseStripeResourceId(raw, "Customer ID");
  if (!id.startsWith("cus_")) {
    throw new ConnectorSdkError("INVALID_INPUT", "Customer ID is not valid.");
  }
  return id;
}
