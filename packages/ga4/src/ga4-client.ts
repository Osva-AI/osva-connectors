export interface Ga4ListAccountSummariesParams {
  readonly pageSize: number;
  readonly pageToken?: string;
  readonly signal?: AbortSignal;
}

export interface Ga4GetPropertyParams {
  readonly propertyId: string;
  readonly signal?: AbortSignal;
}

export interface Ga4GetMetadataParams {
  readonly propertyId: string;
  readonly signal?: AbortSignal;
}

export interface Ga4DateRange {
  readonly startDate: string;
  readonly endDate: string;
}

export interface Ga4NamedField {
  readonly name: string;
}

export interface Ga4RunReportParams {
  readonly propertyId: string;
  readonly dateRanges: readonly Ga4DateRange[];
  readonly dimensions?: readonly Ga4NamedField[];
  readonly metrics: readonly Ga4NamedField[];
  readonly limit: number;
  readonly offset: number;
  readonly dimensionFilter?: unknown;
  readonly metricFilter?: unknown;
  readonly orderBys?: readonly unknown[];
  readonly signal?: AbortSignal;
}

export interface Ga4RunRealtimeReportParams {
  readonly propertyId: string;
  readonly dimensions?: readonly Ga4NamedField[];
  readonly metrics?: readonly Ga4NamedField[];
  readonly limit: number;
  readonly signal?: AbortSignal;
}

export interface Ga4Client {
  listAccountSummaries(params: Ga4ListAccountSummariesParams): Promise<unknown>;

  getProperty(params: Ga4GetPropertyParams): Promise<unknown>;

  getMetadata(params: Ga4GetMetadataParams): Promise<unknown>;

  runReport(params: Ga4RunReportParams): Promise<unknown>;

  runRealtimeReport(params: Ga4RunRealtimeReportParams): Promise<unknown>;
}
