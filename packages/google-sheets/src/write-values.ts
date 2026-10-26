import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  MAX_CELL_STRING_LENGTH,
  MAX_VALUE_COLUMNS,
  MAX_VALUE_ROWS,
} from "./constants.js";

function assertCellValue(value: unknown): string {
  if (typeof value !== "string") {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Cell values must be strings for RAW input.",
    );
  }
  if (value.length > MAX_CELL_STRING_LENGTH) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Cell value exceeds the connector length limit.",
    );
  }
  return value;
}

export function assertWriteValuesMatrix(
  values: readonly (readonly unknown[])[],
): readonly (readonly string[])[] {
  if (values.length === 0) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Values matrix must not be empty.",
    );
  }
  if (values.length > MAX_VALUE_ROWS) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Values matrix exceeds the row limit.",
    );
  }
  let expectedColumns: number | undefined;
  const normalized: string[][] = [];
  for (const row of values) {
    if (!Array.isArray(row)) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Invalid values matrix row.",
      );
    }
    if (row.length === 0 || row.length > MAX_VALUE_COLUMNS) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Values matrix row exceeds the column limit.",
      );
    }
    if (expectedColumns === undefined) {
      expectedColumns = row.length;
    } else if (row.length !== expectedColumns) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Values matrix rows must have the same column count.",
      );
    }
    normalized.push(row.map((cell) => assertCellValue(cell)));
  }
  return normalized;
}
