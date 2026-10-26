export interface GoogleAdsSearchParams {
  readonly customerId: string;
  readonly query: string;
  readonly pageSize?: number;
  readonly pageToken?: string;
  readonly signal?: AbortSignal;
}

export interface GoogleAdsClient {
  listAccessibleCustomers(params: {
    readonly signal?: AbortSignal;
  }): Promise<unknown>;

  search(params: GoogleAdsSearchParams): Promise<unknown>;
}
