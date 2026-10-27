import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { OUTPUT_MAX_PROVIDER_STRING_LENGTH } from "./constants.js";
import {
  assertStructuredOutputWithinBudget,
  normalizeTruncatableProviderString,
  packListWithinOutputBudget,
} from "./output-budget.js";

const MAX_ACTION_ENTRIES = 64;

function readString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "string") {
    return null;
  }
  const normalized = normalizeTruncatableProviderString(
    value,
    OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  );
  return normalized.value.length > 0 ? normalized.value : null;
}

function readMetricString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function normalizeActions(
  value: unknown,
): Array<Record<string, unknown>> | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (!Array.isArray(value)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Meta Ads actions field has an unexpected shape.",
    );
  }
  const result: Array<Record<string, unknown>> = [];
  for (const entry of value.slice(0, MAX_ACTION_ENTRIES)) {
    if (entry === null || typeof entry !== "object") {
      continue;
    }
    const row = entry as Record<string, unknown>;
    result.push({
      actionType: readString(row.action_type),
      value: readMetricString(row.value),
    });
  }
  return result.length > 0 ? result : null;
}

export function mapInsightsRow(raw: unknown): Record<string, unknown> {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Meta Ads returned an unexpected insights row.",
    );
  }
  const row = raw as Record<string, unknown>;

  const breakdownDimensions: Record<string, string | null> = {};
  for (const key of [
    "age",
    "gender",
    "publisher_platform",
    "platform_position",
    "impression_device",
  ]) {
    if (key in row) {
      breakdownDimensions[key] = readString(row[key]);
    }
  }

  return {
    dateStart: readString(row.date_start),
    dateStop: readString(row.date_stop),
    accountId: readString(row.account_id),
    accountCurrency: readString(row.account_currency),
    campaignId: readString(row.campaign_id),
    campaignName: readString(row.campaign_name),
    adSetId: readString(row.adset_id),
    adSetName: readString(row.adset_name),
    adId: readString(row.ad_id),
    adName: readString(row.ad_name),
    spend: readMetricString(row.spend),
    impressions: readMetricString(row.impressions),
    reach: readMetricString(row.reach),
    clicks: readMetricString(row.clicks),
    ctr: readMetricString(row.ctr),
    cpc: readMetricString(row.cpc),
    cpm: readMetricString(row.cpm),
    actions: normalizeActions(row.actions),
    actionValues: normalizeActions(row.action_values),
    ...(Object.keys(breakdownDimensions).length > 0
      ? { breakdown: breakdownDimensions }
      : {}),
  };
}

export interface InsightsResponseContext {
  accountId: string;
  level: "account" | "campaign" | "adset" | "ad" | "breakdown";
  dateRange: { since: string; until: string };
  nextCursor?: string;
  pagesFetched: number;
  attributionNote: string;
  actionAttributionWindows?: readonly string[];
  useUnifiedAttributionSetting?: boolean;
  breakdowns?: readonly string[];
}

export function mapInsightsListResponse(
  rows: readonly unknown[],
  context: InsightsResponseContext,
): Record<string, unknown> {
  const mapped = rows.map(mapInsightsRow);
  const envelope = {
    provenance: {
      source: "meta.marketing_api",
      accountId: context.accountId,
      level: context.level,
      dateRange: context.dateRange,
      pagesFetched: context.pagesFetched,
      ...(context.breakdowns !== undefined
        ? { breakdowns: context.breakdowns }
        : {}),
      ...(context.actionAttributionWindows !== undefined
        ? { actionAttributionWindows: context.actionAttributionWindows }
        : {}),
      ...(context.useUnifiedAttributionSetting === true
        ? { useUnifiedAttributionSetting: true }
        : {}),
    },
    reporting: {
      spendIsDecimalString: true,
      currencyField: "accountCurrency",
      attributionNote: context.attributionNote,
      clicksVsActionsNote:
        "clicks counts all ad clicks; actions arrays enumerate conversion events by action_type. Link clicks and landing page views appear as distinct action_type values when Meta reports them.",
      delayedAttributionNote:
        "Conversion metrics may change retroactively as Meta applies attribution windows and reporting adjustments.",
    },
    ...(context.nextCursor !== undefined
      ? { nextCursor: context.nextCursor }
      : {}),
  };

  const packed = packListWithinOutputBudget(envelope, "rows", mapped);
  assertStructuredOutputWithinBudget(packed);
  return packed;
}

export const DEFAULT_ATTRIBUTION_NOTE =
  "Insights reflect Meta's configured attribution settings for the ad account unless action_attribution_windows or use_unified_attribution_setting overrides are supplied. The connector does not compute ROAS or merge currencies.";
