import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { OUTPUT_MAX_STRUCTURED_JSON_BYTES } from "./constants.js";

export { OUTPUT_MAX_STRUCTURED_JSON_BYTES } from "./constants.js";

const OUTPUT_SIZE_LIMIT_MESSAGE =
  "Normalized BigQuery response exceeds the connector output size limit.";

export function structuredOutputByteLength(payload: unknown): number {
  return Buffer.byteLength(JSON.stringify(payload), "utf8");
}

export function assertStructuredOutputWithinBudget(payload: unknown): void {
  if (structuredOutputByteLength(payload) > OUTPUT_MAX_STRUCTURED_JSON_BYTES) {
    throw new ConnectorSdkError("PROVIDER_ERROR", OUTPUT_SIZE_LIMIT_MESSAGE);
  }
}
