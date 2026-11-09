import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  MAX_FILTER_VALUE_LENGTH,
  MAX_FILTERS_PER_REQUEST,
  MAX_IN_FILTER_VALUES,
} from "./constants.js";

export const POSTGREST_FILTER_OPERATORS = [
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "like",
  "ilike",
  "is",
  "in",
] as const;

export type PostgrestFilterOperator =
  (typeof POSTGREST_FILTER_OPERATORS)[number];

export interface PostgrestFilterInput {
  readonly column: string;
  readonly operator: PostgrestFilterOperator;
  readonly value?: string;
  readonly values?: readonly string[];
}

function normalizeScalar(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_FILTER_VALUE_LENGTH) {
    throw new ConnectorSdkError("INVALID_INPUT", "Filter value is not valid.");
  }
  if (trimmed.includes(",") && trimmed.startsWith("(")) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Raw PostgREST filter syntax is not allowed.",
    );
  }
  return trimmed;
}

function normalizeInValues(values: readonly string[]): string[] {
  if (values.length === 0 || values.length > MAX_IN_FILTER_VALUES) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Filter IN values are not valid.",
    );
  }
  return values.map(normalizeScalar);
}

function encodePostgrestValue(value: string): string {
  if (value === "null" || value === "true" || value === "false") {
    return value;
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric) && String(numeric) === value) {
    return value;
  }
  return `"${value.replaceAll('"', '\\"')}"`;
}

export function buildPostgrestFilterQuery(
  filters: readonly PostgrestFilterInput[],
  allowedColumns: readonly string[],
): string {
  if (filters.length > MAX_FILTERS_PER_REQUEST) {
    throw new ConnectorSdkError("INVALID_INPUT", "Too many filters.");
  }
  const parts: string[] = [];
  for (const filter of filters) {
    if (!POSTGREST_FILTER_OPERATORS.includes(filter.operator)) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Filter operator is not supported.",
      );
    }
    if (!allowedColumns.includes(filter.column)) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Filter column is not allowlisted.",
      );
    }
    if (filter.operator === "in") {
      const values =
        filter.values !== undefined
          ? normalizeInValues(filter.values)
          : filter.value !== undefined
            ? normalizeInValues([filter.value])
            : undefined;
      if (values === undefined) {
        throw new ConnectorSdkError(
          "INVALID_INPUT",
          "Filter IN requires values.",
        );
      }
      const encoded = values.map(encodePostgrestValue).join(",");
      parts.push(`${filter.column}=in.(${encoded})`);
      continue;
    }
    if (filter.operator === "is") {
      if (filter.value === undefined) {
        throw new ConnectorSdkError(
          "INVALID_INPUT",
          "Filter IS requires a value (e.g. null).",
        );
      }
      const v = normalizeScalar(filter.value).toLowerCase();
      if (v !== "null" && v !== "true" && v !== "false") {
        throw new ConnectorSdkError(
          "INVALID_INPUT",
          "Filter IS only supports null, true, or false.",
        );
      }
      parts.push(`${filter.column}=is.${v}`);
      continue;
    }
    if (filter.value === undefined) {
      throw new ConnectorSdkError("INVALID_INPUT", "Filter value is required.");
    }
    const scalar = encodePostgrestValue(normalizeScalar(filter.value));
    parts.push(`${filter.column}=${filter.operator}.${scalar}`);
  }
  return parts.join("&");
}
