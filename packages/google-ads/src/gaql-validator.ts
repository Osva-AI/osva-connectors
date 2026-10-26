import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  GAQL_RESOURCES_REQUIRING_DATE,
  isGaqlFieldAllowed,
  isGaqlResourceAllowed,
  type GaqlAllowedResource,
} from "./gaql-allowlist.js";

const FORBIDDEN_TOKENS =
  /;|--|\/\*|\*\/|\bUNION\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bCREATE\b|\bDROP\b|\bMUTATE\b/i;

export interface ValidatedGaqlQuery {
  readonly query: string;
  readonly resource: GaqlAllowedResource;
  readonly startDate?: string;
  readonly endDate?: string;
}

function normalizeWhitespace(query: string): string {
  return query.replace(/\s+/g, " ").trim();
}

function extractSelectFields(selectClause: string): string[] {
  const inner = selectClause.replace(/^select\s+/i, "").trim();
  if (inner.length === 0) {
    return [];
  }
  return inner
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseFromResource(query: string): string | undefined {
  const match = query.match(/\bfrom\s+([a-z_][a-z0-9_]*)\b/i);
  return match?.[1]?.toLowerCase();
}

function parseDateRange(query: string): { start?: string; end?: string } {
  const between = query.match(
    /segments\.date\s+between\s+'(\d{4}-\d{2}-\d{2})'\s+and\s+'(\d{4}-\d{2}-\d{2})'/i,
  );
  if (between !== null) {
    return { start: between[1], end: between[2] };
  }
  const during = query.match(
    /segments\.date\s+during\s+(LAST_\d+_DAYS|LAST_7_DAYS|LAST_14_DAYS|LAST_30_DAYS|YESTERDAY|TODAY)/i,
  );
  if (during !== null) {
    return {};
  }
  return {};
}

function parseLimit(query: string): number | undefined {
  const match = query.match(/\blimit\s+(\d+)\b/i);
  if (match === null) {
    return undefined;
  }
  return Number(match[1]);
}

export function validateGaqlSelectQuery(
  rawQuery: string,
  maxRows: number,
): ValidatedGaqlQuery {
  if (typeof rawQuery !== "string" || rawQuery.trim().length === 0) {
    throw new ConnectorSdkError("INVALID_INPUT", "GAQL query is required.");
  }
  if (rawQuery.length > 4_096) {
    throw new ConnectorSdkError("INVALID_INPUT", "GAQL query is too long.");
  }
  if (FORBIDDEN_TOKENS.test(rawQuery)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "GAQL query contains unsupported syntax.",
    );
  }

  const query = normalizeWhitespace(rawQuery);
  if (!/^select\s+/i.test(query)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Only SELECT GAQL queries are supported.",
    );
  }

  const resource = parseFromResource(query);
  if (resource === undefined || !isGaqlResourceAllowed(resource)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "GAQL FROM resource is not allowlisted.",
    );
  }

  const selectPart = query.split(/\bfrom\b/i)[0] ?? "";
  const fields = extractSelectFields(selectPart);
  if (fields.length === 0 || fields.length > 25) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "GAQL SELECT field list is invalid.",
    );
  }
  for (const field of fields) {
    if (!isGaqlFieldAllowed(field)) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        `GAQL field is not allowlisted: ${field}`,
      );
    }
  }

  const limit = parseLimit(query);
  if (limit !== undefined && (!Number.isInteger(limit) || limit > maxRows)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "GAQL LIMIT exceeds the configured maximum rows.",
    );
  }

  const dates = parseDateRange(query);
  const hasMetrics = fields.some((field) => field.startsWith("metrics."));
  const hasDateSegment = fields.includes("segments.date");
  if (
    GAQL_RESOURCES_REQUIRING_DATE.has(resource) &&
    (hasMetrics || hasDateSegment)
  ) {
    const hasDateFilter =
      /segments\.date\s+between/i.test(query) ||
      /segments\.date\s+during/i.test(query);
    if (!hasDateSegment || !hasDateFilter) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Performance GAQL queries must include segments.date and a bounded date filter.",
      );
    }
  }

  let finalQuery = query;
  if (!/\blimit\s+\d+\b/i.test(finalQuery)) {
    finalQuery = `${finalQuery} LIMIT ${maxRows}`;
  }

  return {
    query: finalQuery,
    resource,
    ...(dates.start !== undefined ? { startDate: dates.start } : {}),
    ...(dates.end !== undefined ? { endDate: dates.end } : {}),
  };
}

export function buildBoundedDateFilter(
  startDate: string,
  endDate: string,
): string {
  return `segments.date BETWEEN '${startDate}' AND '${endDate}'`;
}
