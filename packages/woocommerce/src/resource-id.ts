import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { MAX_RESOURCE_ID } from "./constants.js";

export function parseWoocommerceResourceId(
  raw: unknown,
  label: string,
): number {
  const value =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number.parseInt(raw.trim(), 10)
        : Number.NaN;
  if (!Number.isInteger(value) || value < 1 || value > MAX_RESOURCE_ID) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      `${label} must be a positive integer.`,
    );
  }
  return value;
}
