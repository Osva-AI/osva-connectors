import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { ANALYTICS_MAX_DATE_RANGE_DAYS } from "./constants.js";

export const ALLOWED_ANALYTICS_METRICS = [
  "SENT",
  "DELIVERED",
  "READ",
  "CLICKED",
  "COST",
] as const;

export type AllowedAnalyticsMetric = (typeof ALLOWED_ANALYTICS_METRICS)[number];

export const ANALYTICS_GRANULARITY = "DAILY" as const;

export function validateAnalyticsDateRange(
  startDate: string,
  endDate: string,
): void {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Analytics date range is invalid.",
    );
  }
  if (end < start) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Analytics end date must be on or after start date.",
    );
  }
  const days = (end - start) / 86_400_000 + 1;
  if (days > ANALYTICS_MAX_DATE_RANGE_DAYS) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Analytics date range exceeds the supported lookback window.",
    );
  }
}

export function validateAnalyticsMetrics(
  metrics: readonly string[],
): AllowedAnalyticsMetric[] {
  if (metrics.length === 0) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "At least one analytics metric is required.",
    );
  }
  const normalized: AllowedAnalyticsMetric[] = [];
  const seen = new Set<string>();
  for (const metric of metrics) {
    const upper = metric.trim().toUpperCase();
    if (!(ALLOWED_ANALYTICS_METRICS as readonly string[]).includes(upper)) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Analytics metric is not supported.",
      );
    }
    if (seen.has(upper)) {
      continue;
    }
    seen.add(upper);
    normalized.push(upper as AllowedAnalyticsMetric);
  }
  return normalized;
}
