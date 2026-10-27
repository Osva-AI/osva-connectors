import { ConnectorSdkError } from "@osva-ai/connector-sdk";

/** Statistics from Klaviyo Reporting API (see reporting_api_overview). */
export const ALLOWED_REPORT_STATISTICS = [
  "average_order_value",
  "bounce_rate",
  "bounced",
  "bounced_or_failed",
  "bounced_or_failed_rate",
  "click_rate",
  "click_to_open_rate",
  "clicks",
  "clicks_unique",
  "conversion_rate",
  "conversion_uniques",
  "conversion_value",
  "conversions",
  "delivered",
  "delivery_rate",
  "failed",
  "failed_rate",
  "open_rate",
  "opens",
  "opens_unique",
  "recipients",
  "revenue_per_recipient",
  "spam_complaint_rate",
  "spam_complaints",
  "unsubscribe_rate",
  "unsubscribe_uniques",
  "unsubscribes",
  "viewed_form",
  "viewed_form_uniques",
  "submits",
  "submit_rate",
  "closed_form",
  "closed_form_uniques",
  "qualified_form",
  "qualified_form_uniques",
  "viewed_form_step",
  "viewed_form_step_uniques",
  "submitted_form_step",
  "submitted_form_step_uniques",
  "total_members",
  "members_added",
  "members_removed",
  "net_members_changed",
  "message_segment_count_sum",
  "text_message_credit_usage_amount",
  "text_message_roi",
  "text_message_spend",
] as const;

export type AllowedReportStatistic = (typeof ALLOWED_REPORT_STATISTICS)[number];

export const ALLOWED_REPORT_TIMEFRAME_KEYS = [
  "today",
  "yesterday",
  "this_week",
  "last_7_days",
  "last_week",
  "this_month",
  "last_30_days",
  "last_month",
  "last_90_days",
  "last_3_months",
  "last_365_days",
  "last_12_months",
  "this_year",
  "last_year",
] as const;

export type AllowedReportTimeframeKey =
  (typeof ALLOWED_REPORT_TIMEFRAME_KEYS)[number];

export const ALLOWED_CAMPAIGN_GROUP_BY = [
  "campaign_id",
  "campaign_message_id",
  "campaign_message_name",
  "send_channel",
  "group",
  "variation_name",
] as const;

export const ALLOWED_FLOW_GROUP_BY = [
  "flow_id",
  "flow_message_id",
  "flow_message_name",
  "send_channel",
  "variation_name",
] as const;

const STATISTIC_SET = new Set<string>(ALLOWED_REPORT_STATISTICS);
const TIMEFRAME_KEY_SET = new Set<string>(ALLOWED_REPORT_TIMEFRAME_KEYS);
const CAMPAIGN_GROUP_SET = new Set<string>(ALLOWED_CAMPAIGN_GROUP_BY);
const FLOW_GROUP_SET = new Set<string>(ALLOWED_FLOW_GROUP_BY);

export const REPORTING_MAX_CUSTOM_TIMEFRAME_DAYS = 366;

const ISO_DATETIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;

export function validateReportStatistics(
  statistics: readonly string[],
): AllowedReportStatistic[] {
  if (statistics.length === 0) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "At least one report statistic is required.",
    );
  }
  if (statistics.length > 32) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Too many report statistics requested.",
    );
  }
  const unique = new Set<string>();
  const validated: AllowedReportStatistic[] = [];
  for (const stat of statistics) {
    const trimmed = stat.trim();
    if (!STATISTIC_SET.has(trimmed)) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Report statistic is not allowlisted.",
      );
    }
    if (unique.has(trimmed)) {
      continue;
    }
    unique.add(trimmed);
    validated.push(trimmed as AllowedReportStatistic);
  }
  return validated;
}

export type ReportTimeframeInput =
  | { readonly kind: "key"; readonly key: AllowedReportTimeframeKey }
  | { readonly kind: "custom"; readonly start: string; readonly end: string };

export function parseReportTimeframeInput(input: {
  timeframeKey?: string;
  start?: string;
  end?: string;
}): ReportTimeframeInput {
  const hasKey =
    input.timeframeKey !== undefined && input.timeframeKey.trim().length > 0;
  const hasStart = input.start !== undefined && input.start.trim().length > 0;
  const hasEnd = input.end !== undefined && input.end.trim().length > 0;

  if (hasKey && (hasStart || hasEnd)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Provide either timeframeKey or start/end, not both.",
    );
  }

  if (hasKey) {
    const key = input.timeframeKey!.trim();
    if (!TIMEFRAME_KEY_SET.has(key)) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Report timeframe key is not allowlisted.",
      );
    }
    return { kind: "key", key: key as AllowedReportTimeframeKey };
  }

  if (!hasStart || !hasEnd) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Report timeframe requires timeframeKey or both start and end.",
    );
  }

  const start = input.start!.trim();
  const end = input.end!.trim();
  if (!ISO_DATETIME_PATTERN.test(start) || !ISO_DATETIME_PATTERN.test(end)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Custom timeframe start/end must be ISO-8601 datetimes.",
    );
  }
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Custom timeframe range is invalid.",
    );
  }
  const days = (endMs - startMs) / 86_400_000;
  if (days > REPORTING_MAX_CUSTOM_TIMEFRAME_DAYS) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Custom timeframe exceeds the maximum one-year span.",
    );
  }
  return { kind: "custom", start, end };
}

export function buildKlaviyoTimeframeAttribute(
  timeframe: ReportTimeframeInput,
): Record<string, string> {
  if (timeframe.kind === "key") {
    return { key: timeframe.key };
  }
  return { start: timeframe.start, end: timeframe.end };
}

export function validateCampaignGroupBy(
  groupBy: readonly string[] | undefined,
): string[] | undefined {
  if (groupBy === undefined || groupBy.length === 0) {
    return undefined;
  }
  if (groupBy.length > 6) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Too many campaign group_by dimensions.",
    );
  }
  const unique = new Set<string>();
  for (const entry of groupBy) {
    const trimmed = entry.trim();
    if (!CAMPAIGN_GROUP_SET.has(trimmed)) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Campaign group_by dimension is not allowlisted.",
      );
    }
    unique.add(trimmed);
  }
  return [...unique];
}

export function validateFlowGroupBy(
  groupBy: readonly string[] | undefined,
): string[] | undefined {
  if (groupBy === undefined || groupBy.length === 0) {
    return undefined;
  }
  if (groupBy.length > 6) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Too many flow group_by dimensions.",
    );
  }
  const unique = new Set<string>();
  for (const entry of groupBy) {
    const trimmed = entry.trim();
    if (!FLOW_GROUP_SET.has(trimmed)) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Flow group_by dimension is not allowlisted.",
      );
    }
    unique.add(trimmed);
  }
  return [...unique];
}
