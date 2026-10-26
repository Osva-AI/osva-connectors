/** Allowlisted GAQL FROM resources for ads.report.query. */
export const GAQL_ALLOWED_RESOURCES = [
  "customer",
  "campaign",
  "ad_group",
  "ad_group_criterion",
  "keyword_view",
  "search_term_view",
  "ad_group_ad_asset_view",
] as const;

export type GaqlAllowedResource = (typeof GAQL_ALLOWED_RESOURCES)[number];

const FIELD_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

export const GAQL_GLOBAL_ALLOWED_FIELDS = new Set<string>([
  "customer.id",
  "customer.descriptive_name",
  "customer.currency_code",
  "customer.time_zone",
  "customer.manager",
  "customer.status",
  "campaign.id",
  "campaign.name",
  "campaign.status",
  "campaign.advertising_channel_type",
  "campaign.start_date",
  "campaign.end_date",
  "ad_group.id",
  "ad_group.name",
  "ad_group.status",
  "ad_group.campaign",
  "ad_group_criterion.criterion_id",
  "ad_group_criterion.keyword.text",
  "ad_group_criterion.keyword.match_type",
  "ad_group_criterion.status",
  "ad_group_criterion.quality_info.quality_score",
  "keyword_view.resource_name",
  "search_term_view.search_term",
  "search_term_view.status",
  "asset.id",
  "asset.name",
  "asset.type",
  "ad_group_ad_asset_view.field_type",
  "ad_group_ad_asset_view.performance_label",
  "segments.date",
  "metrics.impressions",
  "metrics.clicks",
  "metrics.cost_micros",
  "metrics.conversions",
  "metrics.conversions_value",
  "metrics.ctr",
  "metrics.average_cpc",
  "metrics.all_conversions",
  "metrics.view_through_conversions",
]);

export const GAQL_RESOURCES_REQUIRING_DATE = new Set<GaqlAllowedResource>([
  "campaign",
  "ad_group",
  "ad_group_criterion",
  "keyword_view",
  "search_term_view",
  "ad_group_ad_asset_view",
]);

export function isGaqlFieldAllowed(field: string): boolean {
  if (!FIELD_PATTERN.test(field)) {
    return false;
  }
  return GAQL_GLOBAL_ALLOWED_FIELDS.has(field);
}

export function isGaqlResourceAllowed(
  resource: string,
): resource is GaqlAllowedResource {
  return (GAQL_ALLOWED_RESOURCES as readonly string[]).includes(resource);
}
