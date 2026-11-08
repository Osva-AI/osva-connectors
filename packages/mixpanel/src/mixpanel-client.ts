export interface MixpanelSegmentationParams {
  readonly event: string;
  readonly fromDate: string;
  readonly toDate: string;
  readonly unit?: string;
  readonly where?: string;
  readonly on?: string;
  readonly limit?: number;
  readonly signal?: AbortSignal;
}

export interface MixpanelFunnelParams {
  readonly funnelId: string;
  readonly fromDate: string;
  readonly toDate: string;
  readonly unit?: string;
  readonly where?: string;
  readonly on?: string;
  readonly signal?: AbortSignal;
}

export interface MixpanelRetentionParams {
  readonly bornEvent: string;
  readonly event: string;
  readonly fromDate: string;
  readonly toDate: string;
  readonly retentionType?: string;
  readonly unit?: string;
  readonly where?: string;
  readonly on?: string;
  readonly limit?: number;
  readonly signal?: AbortSignal;
}

export interface MixpanelClient {
  getInsights(params: {
    readonly bookmarkId: string;
    readonly signal?: AbortSignal;
  }): Promise<unknown>;

  runSegmentation(params: MixpanelSegmentationParams): Promise<unknown>;

  getFunnel(params: MixpanelFunnelParams): Promise<unknown>;

  runRetention(params: MixpanelRetentionParams): Promise<unknown>;

  listCohorts(params: { readonly signal?: AbortSignal }): Promise<unknown>;

  getTopEvents(params: {
    readonly limit?: number;
    readonly type?: string;
    readonly signal?: AbortSignal;
  }): Promise<unknown>;
}
