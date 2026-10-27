export interface KlaviyoListParams {
  readonly pageSize: number;
  readonly pageCursor?: string;
  readonly signal?: AbortSignal;
}

export interface KlaviyoGetResourceParams {
  readonly id: string;
  readonly signal?: AbortSignal;
}

export interface KlaviyoListEventsParams {
  readonly filter: string;
  readonly pageSize: number;
  readonly pageCursor?: string;
  readonly signal?: AbortSignal;
}

export interface KlaviyoCampaignValuesReportParams {
  readonly statistics: readonly string[];
  readonly timeframe: Record<string, string>;
  readonly conversionMetricId: string;
  readonly groupBy?: readonly string[];
  readonly filter?: string;
  readonly pageCursor?: string;
  readonly signal?: AbortSignal;
}

export interface KlaviyoFlowValuesReportParams {
  readonly statistics: readonly string[];
  readonly timeframe: Record<string, string>;
  readonly conversionMetricId: string;
  readonly groupBy?: readonly string[];
  readonly filter?: string;
  readonly pageCursor?: string;
  readonly signal?: AbortSignal;
}

export interface KlaviyoClient {
  getAccounts(params: { readonly signal?: AbortSignal }): Promise<unknown>;

  listCampaigns(params: KlaviyoListParams): Promise<unknown>;

  getCampaign(params: KlaviyoGetResourceParams): Promise<unknown>;

  listFlows(params: KlaviyoListParams): Promise<unknown>;

  getFlow(params: KlaviyoGetResourceParams): Promise<unknown>;

  listMetrics(params: KlaviyoListParams): Promise<unknown>;

  getMetric(params: KlaviyoGetResourceParams): Promise<unknown>;

  listEvents(params: KlaviyoListEventsParams): Promise<unknown>;

  queryCampaignValuesReport(
    params: KlaviyoCampaignValuesReportParams,
  ): Promise<unknown>;

  queryFlowValuesReport(
    params: KlaviyoFlowValuesReportParams,
  ): Promise<unknown>;
}
