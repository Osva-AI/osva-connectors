import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { MAX_RECORD_ID_LENGTH } from "./constants.js";

const DIGITS_ONLY = /^\d+$/;

export function parseZohoRecordId(value: string, label: string): string {
  const text = value.trim();
  if (text.length === 0 || text.length > MAX_RECORD_ID_LENGTH) {
    throw new ConnectorSdkError("INVALID_INPUT", `${label} is invalid.`);
  }
  if (!DIGITS_ONLY.test(text)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      `${label} must be a numeric string.`,
    );
  }
  return text;
}

export function coerceZohoIdField(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  return undefined;
}
