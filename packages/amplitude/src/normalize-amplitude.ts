import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  assertStructuredOutputWithinBudget,
  normalizeTruncatableProviderString,
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  packListWithinOutputBudget,
} from "./output-budget.js";

/** Documented metrics computed by Amplitude (not re-derived by the connector). */
export const AMPLITUDE_PROVIDER_CALCULATED_LABELS = {
  timeSeries:
    "Series values and x-axis labels are calculated by Amplitude from ingested events.",
  funnelSteps:
    "Funnel conversion and drop-off rates are calculated by Amplitude for the requested steps and mode.",
  retentionCohorts:
    "Retention cohort sizes and return rates are calculated by Amplitude for the start and return events.",
  activeUsers:
    "Active and new user counts are aggregate time-series values from Amplitude.",
  averageSessionLength:
    "Average session length per day is calculated by Amplitude from session instrumentation.",
  savedChart:
    "Saved chart query results reflect the chart definition in Amplitude at query time.",
  eventCatalog:
    "Event type names and volumes come from Amplitude project metadata.",
} as const;

const UNEXPECTED = "Amplitude returned an unexpected payload.";

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function normalizeStringArray(value: unknown): {
  items: string[];
  truncated: boolean;
} {
  if (!Array.isArray(value)) {
    throw new ConnectorSdkError("PROVIDER_ERROR", UNEXPECTED);
  }
  const items: string[] = [];
  let truncated = false;
  for (const entry of value) {
    const normalized = normalizeTruncatableProviderString(
      typeof entry === "string" ? entry : String(entry ?? ""),
      OUTPUT_MAX_PROVIDER_STRING_LENGTH,
    );
    if (normalized.truncated) {
      truncated = true;
    }
    items.push(normalized.value);
  }
  return { items, truncated };
}

export interface NormalizedAmplitudeEnvelope {
  readonly start?: string;
  readonly end?: string;
  readonly data: unknown;
  readonly xValues?: string[];
  readonly seriesMeta?: unknown;
  readonly providerCalculated: (typeof AMPLITUDE_PROVIDER_CALCULATED_LABELS)[keyof typeof AMPLITUDE_PROVIDER_CALCULATED_LABELS];
  readonly stringsTruncated?: true;
  readonly dataTruncatedLocally?: true;
}

export function mapEventListResponse(raw: unknown): unknown {
  const root = asRecord(raw);
  const data = asRecord(root?.data);
  const eventTypes = data?.events ?? root?.events;
  const entries = Array.isArray(eventTypes) ? eventTypes : [];
  const mapped = entries.map((entry) => {
    if (typeof entry === "string") {
      return normalizeTruncatableProviderString(
        entry,
        OUTPUT_MAX_PROVIDER_STRING_LENGTH,
      ).value;
    }
    if (entry !== null && typeof entry === "object") {
      return entry;
    }
    return normalizeTruncatableProviderString(
      String(entry ?? ""),
      OUTPUT_MAX_PROVIDER_STRING_LENGTH,
    ).value;
  });

  const envelope = {
    providerCalculated: AMPLITUDE_PROVIDER_CALCULATED_LABELS.eventCatalog,
  };
  const packed = packListWithinOutputBudget(envelope, "events", mapped);
  assertStructuredOutputWithinBudget(packed);
  return packed;
}

export function mapSeriesAnalyticsResponse(params: {
  raw: unknown;
  start: string;
  end: string;
  providerCalculated: NormalizedAmplitudeEnvelope["providerCalculated"];
}): NormalizedAmplitudeEnvelope {
  const root = asRecord(params.raw);
  const data = asRecord(root?.data) ?? root;
  if (data === undefined) {
    throw new ConnectorSdkError("PROVIDER_ERROR", UNEXPECTED);
  }

  let stringsTruncated = false;
  let xValues: string[] | undefined;
  if (data.xValues !== undefined) {
    const normalized = normalizeStringArray(data.xValues);
    xValues = normalized.items;
    if (normalized.truncated) {
      stringsTruncated = true;
    }
  }

  const seriesMeta = data.seriesMeta;
  const providerXValueCount = Array.isArray(data.xValues)
    ? data.xValues.length
    : 0;
  const dataForOutput = { ...data };
  if (xValues !== undefined) {
    delete dataForOutput.xValues;
  }

  let result: NormalizedAmplitudeEnvelope = {
    start: params.start,
    end: params.end,
    data: dataForOutput,
    ...(seriesMeta !== undefined ? { seriesMeta } : {}),
    providerCalculated: params.providerCalculated,
    ...(stringsTruncated ? { stringsTruncated: true as const } : {}),
  };

  let dataTruncatedLocally = false;
  if (xValues !== undefined) {
    const packed = packListWithinOutputBudget(result, "xValues", xValues);
    const listTruncated =
      "xValuesTruncated" in packed && packed.xValuesTruncated === true;
    dataTruncatedLocally =
      listTruncated || packed.xValues.length < providerXValueCount;
    result = {
      ...packed,
      ...(dataTruncatedLocally ? { dataTruncatedLocally: true as const } : {}),
    };
  }

  assertStructuredOutputWithinBudget(result);
  return result;
}

export function mapChartQueryResponse(params: {
  raw: unknown;
  chartId: string;
}): unknown {
  const root = asRecord(params.raw);
  const result = {
    chartId: params.chartId,
    data: root?.data ?? params.raw,
    providerCalculated: AMPLITUDE_PROVIDER_CALCULATED_LABELS.savedChart,
  };
  assertStructuredOutputWithinBudget(result);
  return result;
}
