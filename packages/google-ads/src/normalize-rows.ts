import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { OUTPUT_MAX_PROVIDER_STRING_LENGTH } from "./constants.js";
import {
  assertStructuredOutputWithinBudget,
  normalizeTruncatableProviderString,
  packListWithinOutputBudget,
} from "./output-budget.js";

export function filterAllowedCustomers(
  customerId: string,
  allowedCustomerIds: readonly string[] | undefined,
): boolean {
  if (allowedCustomerIds === undefined || allowedCustomerIds.length === 0) {
    return true;
  }
  return allowedCustomerIds.includes(customerId);
}

function readMetricNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function readStringField(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = normalizeTruncatableProviderString(
    value,
    OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  );
  return normalized.value.length > 0 ? normalized.value : null;
}

export function microsToCurrencyAmount(
  costMicros: number | null,
  currencyCode: string | null,
): {
  costMicros: number | null;
  cost: number | null;
  currencyCode: string | null;
} {
  if (costMicros === null) {
    return { costMicros: null, cost: null, currencyCode };
  }
  if (currencyCode === null) {
    return { costMicros, cost: null, currencyCode: null };
  }
  return {
    costMicros,
    cost: costMicros / 1_000_000,
    currencyCode,
  };
}

function extractMetrics(
  metrics: Record<string, unknown> | undefined,
  currencyCode: string | null,
): {
  impressions: number | null;
  clicks: number | null;
  costMicros: number | null;
  cost: number | null;
  currencyCode: string | null;
  conversions: number | null;
  conversionsValue: number | null;
  ctr: number | null;
} {
  const m = metrics ?? {};
  const costMicros = readMetricNumber(m.costMicros ?? m.cost_micros);
  const costFields = microsToCurrencyAmount(costMicros, currencyCode);
  return {
    impressions: readMetricNumber(m.impressions),
    clicks: readMetricNumber(m.clicks),
    costMicros: costFields.costMicros,
    cost: costFields.cost,
    currencyCode: costFields.currencyCode,
    conversions: readMetricNumber(m.conversions),
    conversionsValue: readMetricNumber(
      m.conversionsValue ?? m.conversions_value,
    ),
    ctr: readMetricNumber(m.ctr),
  };
}

function extractNested(
  row: Record<string, unknown>,
  key: string,
): Record<string, unknown> | undefined {
  const value = row[key];
  if (value === null || typeof value !== "object") {
    return undefined;
  }
  return value as Record<string, unknown>;
}

export interface MapSearchRowsOptions {
  readonly customerId: string;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly currencyCode?: string | null;
  readonly limit: number;
}

export function mapSearchRowsResponse(
  raw: unknown,
  options: MapSearchRowsOptions,
  mapRow: (
    row: Record<string, unknown>,
    ctx: { currencyCode: string | null },
  ) => Record<string, unknown>,
): {
  customerId: string;
  startDate?: string;
  endDate?: string;
  rows: Record<string, unknown>[];
  rowsTruncated?: true;
  nextPageToken?: string;
  fieldMask?: string;
  notes: string[];
} {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Google Ads returned an unexpected payload.",
    );
  }
  const body = raw as {
    results?: unknown;
    nextPageToken?: unknown;
    fieldMask?: unknown;
  };
  const results = Array.isArray(body.results) ? body.results : [];
  const currencyCode = options.currencyCode ?? null;
  const mapped: Record<string, unknown>[] = [];

  for (const entry of results) {
    if (entry === null || typeof entry !== "object") {
      continue;
    }
    mapped.push(mapRow(entry as Record<string, unknown>, { currencyCode }));
    if (mapped.length >= options.limit) {
      break;
    }
  }

  const notes = [
    "Metrics may be omitted when Google Ads privacy thresholds apply.",
    "Cost is reported in micros; converted cost is provided only when currency is known.",
    "Conversion metrics depend on account attribution settings.",
  ];

  const envelope: {
    customerId: string;
    startDate?: string;
    endDate?: string;
    notes: string[];
    nextPageToken?: string;
    fieldMask?: string;
  } = {
    customerId: options.customerId,
    notes,
    ...(options.startDate !== undefined
      ? { startDate: options.startDate }
      : {}),
    ...(options.endDate !== undefined ? { endDate: options.endDate } : {}),
    ...(typeof body.nextPageToken === "string" && body.nextPageToken.length > 0
      ? { nextPageToken: body.nextPageToken.slice(0, 512) }
      : {}),
    ...(typeof body.fieldMask === "string"
      ? {
          fieldMask: readStringField(body.fieldMask) ?? undefined,
        }
      : {}),
  };

  const packed = packListWithinOutputBudget(envelope, "rows", mapped);
  assertStructuredOutputWithinBudget(packed);
  return packed;
}

export function mapCampaignListRow(
  row: Record<string, unknown>,
  ctx: { currencyCode: string | null },
): Record<string, unknown> {
  const campaign = extractNested(row, "campaign") ?? {};
  const metrics = extractMetrics(
    extractNested(row, "metrics"),
    ctx.currencyCode,
  );
  const segmentDate = extractNested(row, "segments")?.date;
  return {
    campaignId: readMetricNumber(campaign.id),
    name: readStringField(campaign.name),
    status: readStringField(campaign.status),
    advertisingChannelType: readStringField(
      campaign.advertisingChannelType ?? campaign.advertising_channel_type,
    ),
    startDate: readStringField(campaign.startDate ?? campaign.start_date),
    endDate: readStringField(campaign.endDate ?? campaign.end_date),
    ...(typeof segmentDate === "string" ? { date: segmentDate } : {}),
    ...metrics,
  };
}

export function mapCampaignPerformanceRow(
  row: Record<string, unknown>,
  ctx: { currencyCode: string | null },
): Record<string, unknown> {
  const campaign = extractNested(row, "campaign") ?? {};
  const metrics = extractMetrics(
    extractNested(row, "metrics"),
    ctx.currencyCode,
  );
  const date = extractNested(row, "segments")?.date;
  return {
    campaignId: readMetricNumber(campaign.id),
    name: readStringField(campaign.name),
    status: readStringField(campaign.status),
    date: typeof date === "string" ? date : null,
    ...metrics,
  };
}

export function mapAdGroupPerformanceRow(
  row: Record<string, unknown>,
  ctx: { currencyCode: string | null },
): Record<string, unknown> {
  const adGroup =
    extractNested(row, "adGroup") ?? extractNested(row, "ad_group") ?? {};
  const campaign = extractNested(row, "campaign") ?? {};
  const metrics = extractMetrics(
    extractNested(row, "metrics"),
    ctx.currencyCode,
  );
  const date = extractNested(row, "segments")?.date;
  return {
    adGroupId: readMetricNumber(adGroup.id),
    adGroupName: readStringField(adGroup.name),
    adGroupStatus: readStringField(adGroup.status),
    campaignId: readMetricNumber(campaign.id),
    campaignName: readStringField(campaign.name),
    date: typeof date === "string" ? date : null,
    ...metrics,
  };
}

export function mapKeywordPerformanceRow(
  row: Record<string, unknown>,
  ctx: { currencyCode: string | null },
): Record<string, unknown> {
  const criterion =
    extractNested(row, "adGroupCriterion") ??
    extractNested(row, "ad_group_criterion") ??
    {};
  const keyword =
    extractNested(criterion, "keyword") ??
    (criterion.keyword as Record<string, unknown> | undefined);
  const adGroup =
    extractNested(row, "adGroup") ?? extractNested(row, "ad_group") ?? {};
  const campaign = extractNested(row, "campaign") ?? {};
  const metrics = extractMetrics(
    extractNested(row, "metrics"),
    ctx.currencyCode,
  );
  const date = extractNested(row, "segments")?.date;
  return {
    criterionId: readMetricNumber(
      criterion.criterionId ?? criterion.criterion_id,
    ),
    keywordText: readStringField(keyword?.text),
    matchType: readStringField(keyword?.matchType ?? keyword?.match_type),
    status: readStringField(criterion.status),
    adGroupId: readMetricNumber(adGroup.id),
    adGroupName: readStringField(adGroup.name),
    campaignId: readMetricNumber(campaign.id),
    date: typeof date === "string" ? date : null,
    ...metrics,
  };
}

export function mapSearchTermPerformanceRow(
  row: Record<string, unknown>,
  ctx: { currencyCode: string | null },
): Record<string, unknown> {
  const view =
    extractNested(row, "searchTermView") ??
    extractNested(row, "search_term_view") ??
    {};
  const campaign = extractNested(row, "campaign") ?? {};
  const adGroup =
    extractNested(row, "adGroup") ?? extractNested(row, "ad_group") ?? {};
  const metrics = extractMetrics(
    extractNested(row, "metrics"),
    ctx.currencyCode,
  );
  const date = extractNested(row, "segments")?.date;
  return {
    searchTerm: readStringField(view.searchTerm ?? view.search_term),
    status: readStringField(view.status),
    campaignId: readMetricNumber(campaign.id),
    adGroupId: readMetricNumber(adGroup.id),
    date: typeof date === "string" ? date : null,
    ...metrics,
  };
}

export function mapAssetPerformanceRow(
  row: Record<string, unknown>,
  ctx: { currencyCode: string | null },
): Record<string, unknown> {
  const asset = extractNested(row, "asset") ?? {};
  const view =
    extractNested(row, "adGroupAdAssetView") ??
    extractNested(row, "ad_group_ad_asset_view") ??
    {};
  const campaign = extractNested(row, "campaign") ?? {};
  const adGroup =
    extractNested(row, "adGroup") ?? extractNested(row, "ad_group") ?? {};
  const metrics = extractMetrics(
    extractNested(row, "metrics"),
    ctx.currencyCode,
  );
  const date = extractNested(row, "segments")?.date;
  return {
    assetId: readMetricNumber(asset.id),
    assetName: readStringField(asset.name),
    assetType: readStringField(asset.type),
    fieldType: readStringField(view.fieldType ?? view.field_type),
    performanceLabel: readStringField(
      view.performanceLabel ?? view.performance_label,
    ),
    campaignId: readMetricNumber(campaign.id),
    adGroupId: readMetricNumber(adGroup.id),
    date: typeof date === "string" ? date : null,
    ...metrics,
  };
}

export function mapGenericGaqlRow(
  row: Record<string, unknown>,
  ctx: { currencyCode: string | null },
): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === null || value === undefined) {
      continue;
    }
    if (typeof value === "object" && !Array.isArray(value)) {
      output[key] = value;
      continue;
    }
    if (typeof value === "string") {
      output[key] = readStringField(value);
      continue;
    }
    output[key] = value;
  }
  const metrics = extractMetrics(
    extractNested(row, "metrics"),
    ctx.currencyCode,
  );
  if (extractNested(row, "metrics") !== undefined) {
    Object.assign(output, metrics);
  }
  return output;
}
