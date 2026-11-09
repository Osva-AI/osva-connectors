import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  IDENTIFIER_PATTERN,
  MAX_COLUMN_NAME_LENGTH,
  MAX_DATASET_ID_LENGTH,
  MAX_TABLE_ID_LENGTH,
  PROJECT_ID_PATTERN,
} from "./constants.js";

export type BigQueryIdentifierKind = "dataset" | "table" | "column" | "alias";

const IDENTIFIER_MAX_LENGTH: Record<BigQueryIdentifierKind, number> = {
  dataset: MAX_DATASET_ID_LENGTH,
  table: MAX_TABLE_ID_LENGTH,
  column: MAX_COLUMN_NAME_LENGTH,
  alias: MAX_COLUMN_NAME_LENGTH,
};

function invalidIdentifierMessage(kind: BigQueryIdentifierKind): string {
  switch (kind) {
    case "dataset":
    case "table":
      return "Invalid table reference.";
    case "alias":
      return "Invalid aggregate alias.";
    default:
      return "Invalid column identifier.";
  }
}

/**
 * Validates a BigQuery unquoted-identifier subset before any SQL interpolation.
 *
 * GoogleSQL quoted identifiers use backticks. This connector only accepts the
 * unquoted grammar `[A-Za-z_][A-Za-z0-9_]*` and then quotes the value. Backticks
 * and other metacharacters are rejected rather than escaped, so they cannot
 * break out of quoting. Named query parameters are used for values; they cannot
 * substitute for identifiers.
 */
export function assertBigQueryIdentifier(
  value: string,
  kind: BigQueryIdentifierKind = "column",
): string {
  const trimmed = value.trim();
  const maxLength = IDENTIFIER_MAX_LENGTH[kind];
  if (
    trimmed.length === 0 ||
    trimmed.length > maxLength ||
    trimmed.includes("`") ||
    !IDENTIFIER_PATTERN.test(trimmed)
  ) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      invalidIdentifierMessage(kind),
    );
  }
  return trimmed;
}

export function quoteBigQueryIdentifier(
  value: string,
  kind: BigQueryIdentifierKind = "column",
): string {
  const identifier = assertBigQueryIdentifier(value, kind);
  return `\`${identifier}\``;
}

export function quoteBigQueryTable(
  projectId: string,
  datasetId: string,
  tableId: string,
): string {
  if (!PROJECT_ID_PATTERN.test(projectId) || projectId.includes("`")) {
    throw new ConnectorSdkError("INVALID_INPUT", "Invalid table reference.");
  }
  return `\`${projectId}\`.${quoteBigQueryIdentifier(datasetId, "dataset")}.${quoteBigQueryIdentifier(tableId, "table")}`;
}

export function quoteBigQueryColumns(columns: readonly string[]): string {
  return columns
    .map((column) => quoteBigQueryIdentifier(column, "column"))
    .join(", ");
}
