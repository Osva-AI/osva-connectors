import { buildBoundedDateFilter } from "./gaql-validator.js";

export function buildCustomerMetadataQuery(limit: number): string {
  return `SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone, customer.manager, customer.status FROM customer LIMIT ${limit}`;
}

export function buildCampaignListQuery(
  startDate: string | undefined,
  endDate: string | undefined,
  limit: number,
): string {
  const fields = [
    "campaign.id",
    "campaign.name",
    "campaign.status",
    "campaign.advertising_channel_type",
    "campaign.start_date",
    "campaign.end_date",
  ];
  if (startDate !== undefined && endDate !== undefined) {
    fields.push(
      "metrics.impressions",
      "metrics.clicks",
      "metrics.cost_micros",
      "segments.date",
    );
    return `SELECT ${fields.join(", ")} FROM campaign WHERE ${buildBoundedDateFilter(startDate, endDate)} LIMIT ${limit}`;
  }
  return `SELECT ${fields.join(", ")} FROM campaign LIMIT ${limit}`;
}

export function buildCampaignPerformanceQuery(
  startDate: string,
  endDate: string,
  limit: number,
): string {
  return `SELECT campaign.id, campaign.name, campaign.status, segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value, metrics.ctr FROM campaign WHERE ${buildBoundedDateFilter(startDate, endDate)} LIMIT ${limit}`;
}

export function buildAdGroupPerformanceQuery(
  startDate: string,
  endDate: string,
  campaignId: string | undefined,
  limit: number,
): string {
  const campaignFilter =
    campaignId !== undefined ? ` AND campaign.id = ${campaignId}` : "";
  return `SELECT ad_group.id, ad_group.name, ad_group.status, campaign.id, campaign.name, segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value, metrics.ctr FROM ad_group WHERE ${buildBoundedDateFilter(startDate, endDate)}${campaignFilter} LIMIT ${limit}`;
}

export function buildKeywordPerformanceQuery(
  startDate: string,
  endDate: string,
  campaignId: string | undefined,
  limit: number,
): string {
  const campaignFilter =
    campaignId !== undefined ? ` AND campaign.id = ${campaignId}` : "";
  return `SELECT ad_group_criterion.criterion_id, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group_criterion.status, ad_group.id, ad_group.name, campaign.id, segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value, metrics.ctr FROM keyword_view WHERE ${buildBoundedDateFilter(startDate, endDate)}${campaignFilter} LIMIT ${limit}`;
}

export function buildSearchTermPerformanceQuery(
  startDate: string,
  endDate: string,
  campaignId: string | undefined,
  limit: number,
): string {
  const campaignFilter =
    campaignId !== undefined ? ` AND campaign.id = ${campaignId}` : "";
  return `SELECT search_term_view.search_term, search_term_view.status, campaign.id, ad_group.id, segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value, metrics.ctr FROM search_term_view WHERE ${buildBoundedDateFilter(startDate, endDate)}${campaignFilter} LIMIT ${limit}`;
}

export function buildAssetPerformanceQuery(
  startDate: string,
  endDate: string,
  limit: number,
): string {
  return `SELECT asset.id, asset.name, asset.type, ad_group_ad_asset_view.field_type, ad_group_ad_asset_view.performance_label, campaign.id, ad_group.id, segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value, metrics.ctr FROM ad_group_ad_asset_view WHERE ${buildBoundedDateFilter(startDate, endDate)} LIMIT ${limit}`;
}
