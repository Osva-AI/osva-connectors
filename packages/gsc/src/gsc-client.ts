export interface GscListSitesParams {
  readonly signal?: AbortSignal;
}

export interface GscGetSiteParams {
  readonly siteUrl: string;
  readonly signal?: AbortSignal;
}

export interface GscSearchAnalyticsDimensionFilter {
  readonly dimension: string;
  readonly operator: string;
  readonly expression: string;
}

export interface GscSearchAnalyticsDimensionFilterGroup {
  readonly groupType?: string;
  readonly filters: readonly GscSearchAnalyticsDimensionFilter[];
}

export interface GscSearchAnalyticsQueryParams {
  readonly siteUrl: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly dimensions?: readonly string[];
  readonly type?: string;
  readonly aggregationType?: string;
  readonly dataState?: string;
  readonly dimensionFilterGroups?: readonly GscSearchAnalyticsDimensionFilterGroup[];
  readonly rowLimit: number;
  readonly startRow: number;
  readonly signal?: AbortSignal;
}

export interface GscListSitemapsParams {
  readonly siteUrl: string;
  readonly sitemapIndex?: string;
  readonly signal?: AbortSignal;
}

export interface GscGetSitemapParams {
  readonly siteUrl: string;
  readonly sitemapUrl: string;
  readonly signal?: AbortSignal;
}

export interface GscInspectUrlParams {
  readonly siteUrl: string;
  readonly inspectionUrl: string;
  readonly languageCode?: string;
  readonly signal?: AbortSignal;
}

export interface GscClient {
  listSites(params: GscListSitesParams): Promise<unknown>;

  getSite(params: GscGetSiteParams): Promise<unknown>;

  searchAnalyticsQuery(params: GscSearchAnalyticsQueryParams): Promise<unknown>;

  listSitemaps(params: GscListSitemapsParams): Promise<unknown>;

  getSitemap(params: GscGetSitemapParams): Promise<unknown>;

  inspectUrl(params: GscInspectUrlParams): Promise<unknown>;
}
