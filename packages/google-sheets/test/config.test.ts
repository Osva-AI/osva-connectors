import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { loadGoogleSheetsConfig } from "../src/config.js";
import {
  SHEETS_ALLOWED_SPREADSHEETS_ENV,
  SHEETS_TIMEOUT_MS_ENV,
  SHEETS_WRITE_ENABLED_ENV,
} from "../src/constants.js";
import { MOCK_SPREADSHEET_ID } from "./fixtures/mock-sheets-http-server.js";

describe("loadGoogleSheetsConfig", () => {
  it("defaults write to false and parses allowlist", () => {
    const config = loadGoogleSheetsConfig({
      [SHEETS_WRITE_ENABLED_ENV]: "false",
      [SHEETS_ALLOWED_SPREADSHEETS_ENV]: MOCK_SPREADSHEET_ID,
      [SHEETS_TIMEOUT_MS_ENV]: "15000",
    });
    expect(config.writeEnabled).toBe(false);
    expect(config.requestTimeoutMs).toBe(15_000);
    expect(config.allowedSpreadsheetIds).toEqual([MOCK_SPREADSHEET_ID]);
  });

  it("rejects invalid write flag", () => {
    expect(() =>
      loadGoogleSheetsConfig({
        [SHEETS_WRITE_ENABLED_ENV]: "maybe",
      }),
    ).toThrow(ConnectorSdkError);
  });
});
