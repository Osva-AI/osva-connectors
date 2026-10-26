import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  MAX_SPREADSHEET_ID_LENGTH,
  SPREADSHEET_ID_PATTERN,
} from "./constants.js";

export type SpreadsheetAllowlist = {
  readonly allowedSpreadsheetIds: ReadonlySet<string>;
};

export function createSpreadsheetAllowlist(
  allowedSpreadsheetIds: readonly string[] | undefined,
): SpreadsheetAllowlist | undefined {
  if (
    allowedSpreadsheetIds === undefined ||
    allowedSpreadsheetIds.length === 0
  ) {
    return undefined;
  }
  return {
    allowedSpreadsheetIds: new Set(allowedSpreadsheetIds),
  };
}

export function assertSpreadsheetIdFormat(spreadsheetId: string): void {
  if (
    spreadsheetId.length === 0 ||
    spreadsheetId.length > MAX_SPREADSHEET_ID_LENGTH ||
    !SPREADSHEET_ID_PATTERN.test(spreadsheetId)
  ) {
    throw new ConnectorSdkError("INVALID_INPUT", "Invalid spreadsheetId.");
  }
}

export function assertSpreadsheetAllowed(
  allowlist: SpreadsheetAllowlist | undefined,
  spreadsheetId: string,
): void {
  assertSpreadsheetIdFormat(spreadsheetId);
  if (allowlist === undefined) {
    return;
  }
  if (!allowlist.allowedSpreadsheetIds.has(spreadsheetId)) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Spreadsheet is not in the configured allowlist.",
    );
  }
}
