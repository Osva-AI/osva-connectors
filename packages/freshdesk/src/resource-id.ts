import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { MAX_RESOURCE_ID } from "./constants.js";

export function parseFreshdeskResourceId(
  value: number | string,
  label: string,
): number {
  const numeric =
    typeof value === "number" ? value : Number.parseInt(value.trim(), 10);
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > MAX_RESOURCE_ID) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      `${label} must be a positive integer.`,
    );
  }
  return numeric;
}
