import { ConnectorSdkError } from "@osva-ai/connector-sdk";

/** Insights fields requested for all reporting tools (explicit allowlist). */
export const INSIGHTS_FIELD_ALLOWLIST = [
  "spend",
  "impressions",
  "reach",
  "clicks",
  "ctr",
  "cpc",
  "cpm",
  "actions",
  "action_values",
  "date_start",
  "date_stop",
  "account_id",
  "account_currency",
  "campaign_id",
  "campaign_name",
  "adset_id",
  "adset_name",
  "ad_id",
  "ad_name",
] as const;

export const INSIGHTS_METRIC_FIELDS = [
  "spend",
  "impressions",
  "reach",
  "clicks",
  "ctr",
  "cpc",
  "cpm",
  "actions",
  "action_values",
  "date_start",
  "date_stop",
  "account_currency",
] as const;

export const ALLOWED_BREAKDOWNS = [
  "age",
  "gender",
  "publisher_platform",
  "platform_position",
  "impression_device",
] as const;

export type AllowedBreakdown = (typeof ALLOWED_BREAKDOWNS)[number];

/** Documented attribution window tokens accepted when passed to Insights. */
export const ALLOWED_ATTRIBUTION_WINDOWS = [
  "1d_click",
  "7d_click",
  "28d_click",
  "1d_view",
  "7d_view",
  "28d_view",
  "1d_ev",
  "dda",
  "default",
  "skan_click",
  "skan_view",
] as const;

const INCOMPATIBLE_BREAKDOWN_PAIRS: ReadonlyArray<
  readonly [AllowedBreakdown, AllowedBreakdown]
> = [
  ["age", "publisher_platform"],
  ["gender", "platform_position"],
];

export function validateBreakdownSelection(
  breakdowns: readonly AllowedBreakdown[],
): void {
  if (breakdowns.length === 0) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "At least one breakdown is required.",
    );
  }
  if (breakdowns.length > 2) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "At most two breakdown dimensions are supported.",
    );
  }
  const unique = new Set(breakdowns);
  if (unique.size !== breakdowns.length) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Duplicate breakdown dimensions are not allowed.",
    );
  }
  for (const [a, b] of INCOMPATIBLE_BREAKDOWN_PAIRS) {
    if (unique.has(a) && unique.has(b)) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        `Breakdown combination ${a} and ${b} is not supported by Meta Insights.`,
      );
    }
  }
}

export function parseBreakdownInput(
  value: string | readonly string[],
): AllowedBreakdown[] {
  const parts = Array.isArray(value) ? value : [value];
  const result: AllowedBreakdown[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (!(ALLOWED_BREAKDOWNS as readonly string[]).includes(trimmed)) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        `Unsupported breakdown: ${trimmed}.`,
      );
    }
    result.push(trimmed as AllowedBreakdown);
  }
  validateBreakdownSelection(result);
  return result;
}

export function validateAttributionWindows(
  windows: readonly string[] | undefined,
): string[] | undefined {
  if (windows === undefined || windows.length === 0) {
    return undefined;
  }
  const normalized: string[] = [];
  for (const window of windows) {
    const trimmed = window.trim();
    if (!(ALLOWED_ATTRIBUTION_WINDOWS as readonly string[]).includes(trimmed)) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        `Unsupported attribution window: ${trimmed}.`,
      );
    }
    normalized.push(trimmed);
  }
  return normalized;
}
