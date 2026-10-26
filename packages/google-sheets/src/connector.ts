import {
  defineConnector,
  defineTool,
  ConnectorSdkError,
  type DefinedConnector,
} from "@osva-ai/connector-sdk";

import {
  CONNECTOR_KEY,
  CONNECTOR_NAME,
  CONNECTOR_VERSION,
  SHEETS_SHEET_ADD_TOOL,
  SHEETS_SHEET_LIST_TOOL,
  SHEETS_SPREADSHEET_GET_TOOL,
  SHEETS_VALUES_APPEND_TOOL,
  SHEETS_VALUES_BATCH_GET_TOOL,
  SHEETS_VALUES_BATCH_UPDATE_TOOL,
  SHEETS_VALUES_GET_TOOL,
  SHEETS_VALUES_UPDATE_TOOL,
} from "./constants.js";
import {
  mapAddSheetResponse,
  mapSheetListResponse,
  mapSpreadsheetGetResponse,
} from "./normalize-spreadsheet.js";
import {
  mapValuesBatchGetResponse,
  mapValuesBatchUpdateResponse,
  mapValuesGetResponse,
  mapValuesWriteResponse,
} from "./normalize-values.js";
import { assertStructuredOutputWithinBudget } from "./output-budget.js";
import type { GoogleSheetsConfig } from "./schemas.js";
import type { SheetsClient } from "./sheets-client.js";
import { mapSheetsError } from "./map-sheets-error.js";
import {
  createSpreadsheetAllowlist,
  assertSpreadsheetAllowed,
  type SpreadsheetAllowlist,
} from "./spreadsheet-id.js";
import {
  sheetAddInputJsonSchema,
  sheetAddInputSchema,
  sheetListInputJsonSchema,
  sheetListInputSchema,
  spreadsheetGetInputJsonSchema,
  spreadsheetGetInputSchema,
  valuesAppendInputJsonSchema,
  valuesAppendInputSchema,
  valuesBatchGetInputJsonSchema,
  valuesBatchGetInputSchema,
  valuesBatchUpdateInputJsonSchema,
  valuesBatchUpdateInputSchema,
  valuesGetInputJsonSchema,
  valuesGetInputSchema,
  valuesUpdateInputJsonSchema,
  valuesUpdateInputSchema,
} from "./tool-schemas.js";
import { assertUpdateRangeMatchesMatrix } from "./a1-range.js";
import { assertWriteValuesMatrix } from "./write-values.js";

export interface CreateGoogleSheetsConnectorOptions {
  readonly client: SheetsClient;
  readonly config: GoogleSheetsConfig;
  readonly accessTokenForRedaction?: string;
}

function invalidInputError(): ConnectorSdkError {
  return new ConnectorSdkError("INVALID_INPUT", "Invalid tool input.");
}

function mapError(
  error: unknown,
  accessTokenForRedaction?: string,
  ambiguousWrite?: boolean,
): ConnectorSdkError {
  return mapSheetsError(error, {
    ...(accessTokenForRedaction !== undefined
      ? { accessToken: accessTokenForRedaction }
      : {}),
    ...(ambiguousWrite === true ? { ambiguousWrite: true } : {}),
  });
}

function assertWriteEnabled(config: GoogleSheetsConfig): void {
  if (!config.writeEnabled) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Google Sheets writes are disabled. Set OSVA_CONNECTOR_GOOGLE_SHEETS_WRITE_ENABLED=true to allow mutations.",
    );
  }
}

export function createGoogleSheetsConnector(
  options: CreateGoogleSheetsConnectorOptions,
): DefinedConnector {
  const config = options.config;
  const allowlist: SpreadsheetAllowlist | undefined =
    createSpreadsheetAllowlist(config.allowedSpreadsheetIds);
  const redactionToken = options.accessTokenForRedaction;

  return defineConnector({
    key: CONNECTOR_KEY,
    name: CONNECTOR_NAME,
    description:
      "Google Sheets connector for OSVA Connector Profile V1: spreadsheet metadata, bounded value reads, and controlled cell/sheet mutations when explicitly enabled via environment configuration. Requires Google Application Default Credentials or a service account with Sheets access. Cell values returned by read tools are untrusted external content. Mutating tools are external side effects; host workflows must enforce approval before writes.",
    version: CONNECTOR_VERSION,
    tools: [
      defineTool({
        name: SHEETS_SPREADSHEET_GET_TOOL,
        description:
          "Returns normalized spreadsheet metadata via spreadsheets.get (title, locale, time zone, sheet count).",
        inputSchema: spreadsheetGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = spreadsheetGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            assertSpreadsheetAllowed(allowlist, parsed.data.spreadsheetId);
            const raw = await options.client.getSpreadsheet({
              spreadsheetId: parsed.data.spreadsheetId,
              signal: context.signal,
            });
            const result = mapSpreadsheetGetResponse(raw);
            assertStructuredOutputWithinBudget(result);
            return result;
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),

      defineTool({
        name: SHEETS_SHEET_LIST_TOOL,
        description:
          "Lists sheets in a spreadsheet with normalized tab metadata (sheetId, title, index, grid size).",
        inputSchema: sheetListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = sheetListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            assertSpreadsheetAllowed(allowlist, parsed.data.spreadsheetId);
            const raw = await options.client.listSheets({
              spreadsheetId: parsed.data.spreadsheetId,
              signal: context.signal,
            });
            return mapSheetListResponse(raw);
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),

      defineTool({
        name: SHEETS_VALUES_GET_TOOL,
        description:
          "Reads cell values for an A1 range via spreadsheets.values.get. Content is untrusted.",
        inputSchema: valuesGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = valuesGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            assertSpreadsheetAllowed(allowlist, parsed.data.spreadsheetId);
            const raw = await options.client.getValues({
              spreadsheetId: parsed.data.spreadsheetId,
              range: parsed.data.range,
              ...(parsed.data.valueRenderOption !== undefined
                ? { valueRenderOption: parsed.data.valueRenderOption }
                : {}),
              signal: context.signal,
            });
            return mapValuesGetResponse(raw);
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),

      defineTool({
        name: SHEETS_VALUES_BATCH_GET_TOOL,
        description:
          "Reads multiple A1 ranges via spreadsheets.values.batchGet. Content is untrusted.",
        inputSchema: valuesBatchGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = valuesBatchGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            assertSpreadsheetAllowed(allowlist, parsed.data.spreadsheetId);
            const raw = await options.client.batchGetValues({
              spreadsheetId: parsed.data.spreadsheetId,
              ranges: parsed.data.ranges,
              ...(parsed.data.valueRenderOption !== undefined
                ? { valueRenderOption: parsed.data.valueRenderOption }
                : {}),
              signal: context.signal,
            });
            return mapValuesBatchGetResponse(raw);
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),

      defineTool({
        name: SHEETS_VALUES_APPEND_TOOL,
        description:
          "Appends RAW rows via spreadsheets.values.append with INSERT_ROWS. Requires write enablement.",
        inputSchema: valuesAppendInputJsonSchema,
        handler: async (input, context) => {
          const parsed = valuesAppendInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertWriteEnabled(config);
          try {
            assertSpreadsheetAllowed(allowlist, parsed.data.spreadsheetId);
            const values = assertWriteValuesMatrix(parsed.data.values);
            const raw = await options.client.appendValues({
              spreadsheetId: parsed.data.spreadsheetId,
              range: parsed.data.range,
              values,
              signal: context.signal,
            });
            const result = mapValuesWriteResponse(raw);
            assertStructuredOutputWithinBudget(result);
            return result;
          } catch (error) {
            throw mapError(error, redactionToken, true);
          }
        },
      }),

      defineTool({
        name: SHEETS_VALUES_UPDATE_TOOL,
        description:
          "Overwrites RAW values in an A1 range via spreadsheets.values.update. Requires write enablement.",
        inputSchema: valuesUpdateInputJsonSchema,
        handler: async (input, context) => {
          const parsed = valuesUpdateInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertWriteEnabled(config);
          try {
            assertSpreadsheetAllowed(allowlist, parsed.data.spreadsheetId);
            assertUpdateRangeMatchesMatrix(
              parsed.data.range,
              parsed.data.values,
            );
            const values = assertWriteValuesMatrix(parsed.data.values);
            const raw = await options.client.updateValues({
              spreadsheetId: parsed.data.spreadsheetId,
              range: parsed.data.range,
              values,
              signal: context.signal,
            });
            const result = mapValuesWriteResponse(raw);
            assertStructuredOutputWithinBudget(result);
            return result;
          } catch (error) {
            throw mapError(error, redactionToken, true);
          }
        },
      }),

      defineTool({
        name: SHEETS_VALUES_BATCH_UPDATE_TOOL,
        description:
          "Updates multiple RAW ranges via spreadsheets.values.batchUpdate. Requires write enablement.",
        inputSchema: valuesBatchUpdateInputJsonSchema,
        handler: async (input, context) => {
          const parsed = valuesBatchUpdateInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertWriteEnabled(config);
          try {
            assertSpreadsheetAllowed(allowlist, parsed.data.spreadsheetId);
            const data = parsed.data.data.map((entry) => {
              assertUpdateRangeMatchesMatrix(entry.range, entry.values);
              return {
                range: entry.range,
                values: assertWriteValuesMatrix(entry.values),
              };
            });
            const raw = await options.client.batchUpdateValues({
              spreadsheetId: parsed.data.spreadsheetId,
              data,
              signal: context.signal,
            });
            const result = mapValuesBatchUpdateResponse(raw);
            assertStructuredOutputWithinBudget(result);
            return result;
          } catch (error) {
            throw mapError(error, redactionToken, true);
          }
        },
      }),

      defineTool({
        name: SHEETS_SHEET_ADD_TOOL,
        description:
          "Adds a sheet tab via spreadsheets.batchUpdate (AddSheetRequest only). Requires write enablement.",
        inputSchema: sheetAddInputJsonSchema,
        handler: async (input, context) => {
          const parsed = sheetAddInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertWriteEnabled(config);
          try {
            assertSpreadsheetAllowed(allowlist, parsed.data.spreadsheetId);
            const raw = await options.client.addSheet({
              spreadsheetId: parsed.data.spreadsheetId,
              title: parsed.data.title,
              ...(parsed.data.rowCount !== undefined
                ? { rowCount: parsed.data.rowCount }
                : {}),
              ...(parsed.data.columnCount !== undefined
                ? { columnCount: parsed.data.columnCount }
                : {}),
              signal: context.signal,
            });
            const result = mapAddSheetResponse(raw);
            assertStructuredOutputWithinBudget(result);
            return result;
          } catch (error) {
            throw mapError(error, redactionToken, true);
          }
        },
      }),
    ],
  });
}
