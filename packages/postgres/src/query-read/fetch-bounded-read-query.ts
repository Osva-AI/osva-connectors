import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import type { FieldDef } from "pg";

import { OUTPUT_MAX_STRUCTURED_JSON_BYTES } from "../output-budget.js";
import { QUERY_READ_FETCH_BATCH_SIZE } from "./constants.js";
import {
  buildColumnsFromFields,
  normalizeRawRow,
  type NormalizedColumn,
  type NormalizeReadQueryResult,
  structuredReadOutputBytes,
} from "./normalize-result.js";

export interface BoundedFetchCursor {
  read(rowCount: number): Promise<unknown[]>;
  close(): Promise<void>;
}

function getCursorFields(
  cursor: BoundedFetchCursor & { _result?: { fields?: FieldDef[] } },
): FieldDef[] {
  const fields = cursor._result?.fields;
  if (fields === undefined || fields.length === 0) {
    throw new Error("PostgreSQL cursor did not return column metadata.");
  }
  return fields;
}

function tryAppendRow(options: {
  columns: NormalizedColumn[];
  rows: unknown[][];
  normalizedRow: unknown[];
  truncated: boolean;
}): { truncated: boolean; stop: boolean } {
  const candidateRows = [...options.rows, options.normalizedRow];
  const candidateBytes = structuredReadOutputBytes({
    columns: options.columns,
    rows: candidateRows,
    truncated: options.truncated,
  });
  if (candidateBytes <= OUTPUT_MAX_STRUCTURED_JSON_BYTES) {
    options.rows.push(options.normalizedRow);
    return { truncated: options.truncated, stop: false };
  }
  if (options.rows.length === 0) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "PostgreSQL returned a row that exceeds the connector output budget.",
    );
  }
  return { truncated: true, stop: true };
}

export async function fetchBoundedReadQueryResult(options: {
  cursor: BoundedFetchCursor & { _result?: { fields?: FieldDef[] } };
  maxRows: number;
}): Promise<NormalizeReadQueryResult> {
  let columns: NormalizedColumn[] | undefined;
  const rows: unknown[][] = [];
  let truncated = false;

  while (rows.length < options.maxRows) {
    const room = options.maxRows - rows.length;
    const request = Math.min(QUERY_READ_FETCH_BATCH_SIZE, room);
    const batch = (await options.cursor.read(request)) as unknown[][];
    if (batch.length === 0) {
      break;
    }
    if (columns === undefined) {
      columns = buildColumnsFromFields(getCursorFields(options.cursor));
    }

    for (let index = 0; index < batch.length; index += 1) {
      if (rows.length >= options.maxRows) {
        truncated = true;
        break;
      }
      const normalizedRow = normalizeRawRow(columns, batch[index]!);
      const appendResult = tryAppendRow({
        columns,
        rows,
        normalizedRow,
        truncated,
      });
      truncated = appendResult.truncated;
      if (appendResult.stop) {
        return { columns, rows, rowCount: rows.length, truncated };
      }
    }

    if (truncated) {
      break;
    }
    if (batch.length < request) {
      break;
    }
  }

  if (columns === undefined) {
    columns = buildColumnsFromFields(getCursorFields(options.cursor));
  }

  if (rows.length === options.maxRows && !truncated) {
    const peek = (await options.cursor.read(1)) as unknown[][];
    if (peek.length > 0) {
      truncated = true;
    }
  }

  return {
    columns,
    rows,
    rowCount: rows.length,
    truncated,
  };
}
