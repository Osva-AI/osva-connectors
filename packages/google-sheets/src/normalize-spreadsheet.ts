import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  normalizeEssentialProviderString,
  normalizeTruncatableProviderString,
  packListWithinOutputBudget,
} from "./output-budget.js";

interface RawSpreadsheet {
  readonly spreadsheetId?: unknown;
  readonly properties?: {
    readonly title?: unknown;
    readonly locale?: unknown;
    readonly timeZone?: unknown;
  };
  readonly sheets?: readonly RawSheet[];
}

interface RawSheet {
  readonly properties?: {
    readonly sheetId?: unknown;
    readonly title?: unknown;
    readonly index?: unknown;
    readonly sheetType?: unknown;
    readonly hidden?: unknown;
    readonly gridProperties?: {
      readonly rowCount?: unknown;
      readonly columnCount?: unknown;
    };
  };
}

export function mapSpreadsheetGetResponse(raw: unknown): {
  spreadsheetId: string;
  title?: string;
  locale?: string;
  timeZone?: string;
  sheetCount: number;
} {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Google Sheets returned an unexpected payload.",
    );
  }
  const body = raw as RawSpreadsheet;
  const spreadsheetId = normalizeEssentialProviderString(
    body.spreadsheetId,
    OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  );
  const titleRaw = body.properties?.title;
  const title =
    titleRaw === undefined
      ? undefined
      : normalizeTruncatableProviderString(
          titleRaw,
          OUTPUT_MAX_PROVIDER_STRING_LENGTH,
        ).value;
  const localeRaw = body.properties?.locale;
  const locale =
    localeRaw === undefined
      ? undefined
      : normalizeEssentialProviderString(
          localeRaw,
          OUTPUT_MAX_PROVIDER_STRING_LENGTH,
        );
  const timeZoneRaw = body.properties?.timeZone;
  const timeZone =
    timeZoneRaw === undefined
      ? undefined
      : normalizeEssentialProviderString(
          timeZoneRaw,
          OUTPUT_MAX_PROVIDER_STRING_LENGTH,
        );
  const sheets = Array.isArray(body.sheets) ? body.sheets : [];
  return {
    spreadsheetId,
    ...(title !== undefined ? { title } : {}),
    ...(locale !== undefined ? { locale } : {}),
    ...(timeZone !== undefined ? { timeZone } : {}),
    sheetCount: sheets.length,
  };
}

export function mapSheetListResponse(raw: unknown): {
  spreadsheetId: string;
  sheets: {
    sheetId: number;
    title: string;
    index: number;
    sheetType?: string;
    hidden?: boolean;
    rowCount?: number;
    columnCount?: number;
  }[];
  sheetsTruncated?: true;
} {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Google Sheets returned an unexpected payload.",
    );
  }
  const body = raw as RawSpreadsheet;
  const spreadsheetId = normalizeEssentialProviderString(
    body.spreadsheetId,
    OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  );
  const sheetsRaw = Array.isArray(body.sheets) ? body.sheets : [];
  const mapped = sheetsRaw.map((sheet) => mapSheetEntry(sheet));
  const packed = packListWithinOutputBudget(
    { spreadsheetId },
    "sheets",
    mapped,
  );
  return packed;
}

function mapSheetEntry(sheet: RawSheet): {
  sheetId: number;
  title: string;
  index: number;
  sheetType?: string;
  hidden?: boolean;
  rowCount?: number;
  columnCount?: number;
} {
  const props = sheet.properties;
  if (props === undefined || props === null || typeof props !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Google Sheets returned an unexpected payload.",
    );
  }
  const sheetId = props.sheetId;
  const index = props.index;
  if (typeof sheetId !== "number" || !Number.isInteger(sheetId)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Google Sheets returned an unexpected payload.",
    );
  }
  if (typeof index !== "number" || !Number.isInteger(index)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Google Sheets returned an unexpected payload.",
    );
  }
  const title = normalizeTruncatableProviderString(
    props.title,
    OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  ).value;
  const sheetTypeRaw = props.sheetType;
  const sheetType =
    sheetTypeRaw === undefined
      ? undefined
      : normalizeEssentialProviderString(
          sheetTypeRaw,
          OUTPUT_MAX_PROVIDER_STRING_LENGTH,
        );
  const hidden =
    props.hidden === undefined
      ? undefined
      : props.hidden === true
        ? true
        : props.hidden === false
          ? false
          : undefined;
  const grid = props.gridProperties;
  const rowCount =
    grid !== undefined &&
    grid !== null &&
    typeof grid.rowCount === "number" &&
    Number.isInteger(grid.rowCount)
      ? grid.rowCount
      : undefined;
  const columnCount =
    grid !== undefined &&
    grid !== null &&
    typeof grid.columnCount === "number" &&
    Number.isInteger(grid.columnCount)
      ? grid.columnCount
      : undefined;
  return {
    sheetId,
    title,
    index,
    ...(sheetType !== undefined ? { sheetType } : {}),
    ...(hidden !== undefined ? { hidden } : {}),
    ...(rowCount !== undefined ? { rowCount } : {}),
    ...(columnCount !== undefined ? { columnCount } : {}),
  };
}

export function mapAddSheetResponse(raw: unknown): {
  spreadsheetId: string;
  sheetId: number;
  title: string;
  index: number;
} {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Google Sheets returned an unexpected payload.",
    );
  }
  const body = raw as {
    readonly spreadsheetId?: unknown;
    readonly replies?: readonly {
      readonly addSheet?: {
        readonly properties?: {
          readonly sheetId?: unknown;
          readonly title?: unknown;
          readonly index?: unknown;
        };
      };
    }[];
  };
  const spreadsheetId = normalizeEssentialProviderString(
    body.spreadsheetId,
    OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  );
  const reply = body.replies?.[0]?.addSheet?.properties;
  if (reply === undefined) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Google Sheets returned an unexpected payload.",
    );
  }
  const sheetId = reply.sheetId;
  const index = reply.index;
  if (typeof sheetId !== "number" || !Number.isInteger(sheetId)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Google Sheets returned an unexpected payload.",
    );
  }
  if (typeof index !== "number" || !Number.isInteger(index)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Google Sheets returned an unexpected payload.",
    );
  }
  const title = normalizeTruncatableProviderString(
    reply.title,
    OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  ).value;
  return { spreadsheetId, sheetId, title, index };
}
