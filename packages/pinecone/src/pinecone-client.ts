export interface PineconeVectorQueryParams {
  readonly indexName: string;
  readonly vector: readonly number[];
  readonly topK?: number;
  readonly namespace?: string;
  readonly filter?: unknown;
  readonly includeMetadata?: boolean;
  readonly includeValues?: boolean;
  readonly signal?: AbortSignal;
}

export interface PineconeVectorFetchParams {
  readonly indexName: string;
  readonly ids: readonly string[];
  readonly namespace?: string;
  readonly signal?: AbortSignal;
}

export interface PineconeVectorListParams {
  readonly indexName: string;
  readonly namespace?: string;
  readonly limit?: number;
  readonly paginationToken?: string;
  readonly signal?: AbortSignal;
}

export interface PineconeUpsertVectorRecord {
  readonly id: string;
  readonly values: readonly number[];
  readonly metadata?: Record<string, unknown>;
}

export interface PineconeVectorUpsertParams {
  readonly indexName: string;
  readonly namespace?: string;
  readonly vectors: readonly PineconeUpsertVectorRecord[];
  readonly signal?: AbortSignal;
}

export interface PineconeIndexStatsParams {
  readonly indexName: string;
  readonly namespace?: string;
  readonly signal?: AbortSignal;
}

export interface PineconeClient {
  listIndexes(signal?: AbortSignal): Promise<unknown>;
  describeIndex(indexName: string, signal?: AbortSignal): Promise<unknown>;
  describeIndexStats(params: PineconeIndexStatsParams): Promise<unknown>;
  queryVectors(params: PineconeVectorQueryParams): Promise<unknown>;
  fetchVectors(params: PineconeVectorFetchParams): Promise<unknown>;
  listVectors(params: PineconeVectorListParams): Promise<unknown>;
  upsertVectors(params: PineconeVectorUpsertParams): Promise<unknown>;
}
