export interface AmplitudeDateRangeParams {
  readonly start: string;
  readonly end: string;
  readonly signal?: AbortSignal;
}

export interface AmplitudeSegmentationParams extends AmplitudeDateRangeParams {
  readonly event: unknown;
  readonly secondEvent?: unknown;
  readonly metric?: string;
  readonly interval?: number;
  readonly groupBy?: readonly string[];
  readonly segment?: string;
  readonly limit?: number;
}

export interface AmplitudeFunnelParams extends AmplitudeDateRangeParams {
  readonly events: readonly unknown[];
  readonly mode?: "ordered" | "unordered" | "sequential";
  readonly userType?: "new" | "active";
  readonly interval?: number;
  readonly groupBy?: string;
  readonly segment?: string;
}

export interface AmplitudeRetentionParams extends AmplitudeDateRangeParams {
  readonly startEvent: unknown;
  readonly returnEvent: unknown;
  readonly retentionMode?: string;
  readonly interval?: number;
  readonly groupBy?: string;
  readonly segment?: string;
}

export interface AmplitudeActiveUsersParams extends AmplitudeDateRangeParams {
  readonly userMetric?: "new" | "active";
  readonly interval?: number;
  readonly groupBy?: string;
  readonly segment?: string;
}

export interface AmplitudeChartQueryParams {
  readonly chartId: string;
  readonly signal?: AbortSignal;
}

export interface AmplitudeClient {
  listEventTypes(params: { readonly signal?: AbortSignal }): Promise<unknown>;

  queryEventSegmentation(params: AmplitudeSegmentationParams): Promise<unknown>;

  queryFunnel(params: AmplitudeFunnelParams): Promise<unknown>;

  queryRetention(params: AmplitudeRetentionParams): Promise<unknown>;

  queryActiveUsers(params: AmplitudeActiveUsersParams): Promise<unknown>;

  queryChart(params: AmplitudeChartQueryParams): Promise<unknown>;

  queryAverageSessionLength(params: AmplitudeDateRangeParams): Promise<unknown>;
}
