import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { MAX_SALESFORCE_ID_LENGTH } from "./constants.js";

const SALESFORCE_ID_PATTERN = /^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/;

export function parseSalesforceRecordId(
  value: string | number,
  label: string,
): string {
  const text = String(value).trim();
  if (
    text.length === 0 ||
    text.length > MAX_SALESFORCE_ID_LENGTH ||
    !SALESFORCE_ID_PATTERN.test(text)
  ) {
    throw new ConnectorSdkError("INVALID_INPUT", `${label} is invalid.`);
  }
  return text;
}
