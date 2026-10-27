import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { extractCursorFromNextLink } from "./pagination.js";
import {
  assertStructuredOutputWithinBudget,
  packListWithinOutputBudget,
} from "./output-budget.js";
import { KLAVIYO_API_HOST } from "./constants.js";

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

interface ReportResultRow {
  readonly groupings?: Record<string, unknown>;
  readonly statistics?: Record<string, unknown>;
}

function normalizeReportResultRow(row: unknown): ReportResultRow {
  const record = asRecord(row);
  if (record === undefined) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Klaviyo returned an unexpected report row.",
    );
  }
  const groupings = asRecord(record.groupings);
  const statistics = asRecord(record.statistics);
  return {
    ...(groupings !== undefined ? { groupings } : {}),
    ...(statistics !== undefined ? { statistics } : {}),
  };
}

export function mapValuesReportResponse(
  kind: "campaign" | "flow",
  raw: unknown,
  apiHost: string = KLAVIYO_API_HOST,
): unknown {
  const root = asRecord(raw);
  const data = asRecord(root?.data);
  const attributes = asRecord(data?.attributes);
  const resultsRaw = attributes?.results;
  const results = Array.isArray(resultsRaw)
    ? resultsRaw.map(normalizeReportResultRow)
    : [];

  const nextCursor = extractCursorFromNextLink(root?.links, apiHost);

  const envelope = {
    kind,
    reportType:
      kind === "campaign" ? "campaign-values-report" : "flow-values-report",
    ...(nextCursor !== undefined ? { nextCursor } : {}),
  };

  const result = packListWithinOutputBudget(envelope, "results", results);
  assertStructuredOutputWithinBudget(result);
  return result;
}
