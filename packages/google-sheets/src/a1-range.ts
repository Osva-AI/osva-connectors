import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { MAX_A1_RANGE_LENGTH } from "./constants.js";

const COLUMN_LETTERS = /^[A-Za-z]+$/;
const ROW_DIGITS = /^[1-9][0-9]*$/;

function columnLettersToIndex(letters: string): number {
  let index = 0;
  const upper = letters.toUpperCase();
  for (let i = 0; i < upper.length; i += 1) {
    const code = upper.charCodeAt(i);
    if (code < 65 || code > 90) {
      throw new ConnectorSdkError("INVALID_INPUT", "Invalid A1 range.");
    }
    index = index * 26 + (code - 64);
  }
  return index;
}

function parseCellReference(ref: string): { col: number; row: number } {
  const match = /^([A-Za-z]+)([1-9][0-9]*)$/.exec(ref);
  if (match === null) {
    throw new ConnectorSdkError("INVALID_INPUT", "Invalid A1 range.");
  }
  const colLetters = match[1];
  const rowDigits = match[2];
  if (
    colLetters === undefined ||
    rowDigits === undefined ||
    !COLUMN_LETTERS.test(colLetters) ||
    !ROW_DIGITS.test(rowDigits)
  ) {
    throw new ConnectorSdkError("INVALID_INPUT", "Invalid A1 range.");
  }
  const col = columnLettersToIndex(colLetters);
  if (col < 1 || col > 16_384) {
    throw new ConnectorSdkError("INVALID_INPUT", "Invalid A1 range.");
  }
  const row = Number(rowDigits);
  if (row < 1 || row > 10_000_000) {
    throw new ConnectorSdkError("INVALID_INPUT", "Invalid A1 range.");
  }
  return { col, row };
}

function parseSheetPrefix(range: string): {
  sheetTitle?: string;
  rest: string;
} {
  const bang = range.indexOf("!");
  if (bang === -1) {
    return { rest: range };
  }
  const prefix = range.slice(0, bang);
  const rest = range.slice(bang + 1);
  if (rest.length === 0) {
    throw new ConnectorSdkError("INVALID_INPUT", "Invalid A1 range.");
  }
  if (prefix.startsWith("'") && prefix.endsWith("'")) {
    const inner = prefix.slice(1, -1).replace(/''/g, "'");
    if (inner.length === 0 || /[\0\r\n]/.test(inner)) {
      throw new ConnectorSdkError("INVALID_INPUT", "Invalid A1 range.");
    }
    return { sheetTitle: inner, rest };
  }
  if (
    prefix.length === 0 ||
    /[\0\r\n'!]/.test(prefix) ||
    prefix.startsWith("'")
  ) {
    throw new ConnectorSdkError("INVALID_INPUT", "Invalid A1 range.");
  }
  return { sheetTitle: prefix, rest };
}

function parseRangeBody(body: string): void {
  if (body.length === 0) {
    throw new ConnectorSdkError("INVALID_INPUT", "Invalid A1 range.");
  }
  const parts = body.split(":");
  if (parts.length > 2) {
    throw new ConnectorSdkError("INVALID_INPUT", "Invalid A1 range.");
  }
  const start = parseCellReference(parts[0] ?? "");
  if (parts.length === 1) {
    return;
  }
  const end = parseCellReference(parts[1] ?? "");
  if (end.col < start.col || end.row < start.row) {
    throw new ConnectorSdkError("INVALID_INPUT", "Invalid A1 range.");
  }
}

/**
 * Validates a subset of Google Sheets A1 notation (sheet prefix optional).
 */
export function assertValidA1Range(range: string): void {
  const trimmed = range.trim();
  if (
    trimmed.length === 0 ||
    trimmed.length > MAX_A1_RANGE_LENGTH ||
    /[\0\r\n]/.test(trimmed)
  ) {
    throw new ConnectorSdkError("INVALID_INPUT", "Invalid A1 range.");
  }
  const { rest } = parseSheetPrefix(trimmed);
  parseRangeBody(rest);
}

export function encodeA1RangeForPath(range: string): string {
  assertValidA1Range(range);
  return encodeURIComponent(range.trim());
}

export function rangeDimensions(range: string): {
  rows: number;
  columns: number;
} {
  assertValidA1Range(range);
  const { rest } = parseSheetPrefix(range.trim());
  const parts = rest.split(":");
  const start = parseCellReference(parts[0] ?? "");
  if (parts.length === 1) {
    return { rows: 1, columns: 1 };
  }
  const end = parseCellReference(parts[1] ?? "");
  return {
    rows: end.row - start.row + 1,
    columns: end.col - start.col + 1,
  };
}

export function assertUpdateRangeMatchesMatrix(
  range: string,
  values: readonly (readonly unknown[])[],
): void {
  const { rows, columns } = rangeDimensions(range);
  if (values.length !== rows) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Values matrix row count does not match the A1 range.",
    );
  }
  for (const row of values) {
    if (!Array.isArray(row) || row.length !== columns) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Values matrix column count does not match the A1 range.",
      );
    }
  }
}
