import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { OUTPUT_MAX_STRUCTURED_JSON_BYTES } from "./constants.js";

export function structuredOutputByteLength(payload: unknown): number {
  return Buffer.byteLength(JSON.stringify(payload), "utf8");
}

export function assertStructuredOutputWithinBudget(payload: unknown): void {
  if (structuredOutputByteLength(payload) > OUTPUT_MAX_STRUCTURED_JSON_BYTES) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Supabase response exceeds the connector output size limit.",
    );
  }
}

export function pickAllowlistedRowFields(
  row: Record<string, unknown>,
  columns: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const column of columns) {
    if (Object.hasOwn(row, column)) {
      out[column] = row[column];
    }
  }
  return out;
}
