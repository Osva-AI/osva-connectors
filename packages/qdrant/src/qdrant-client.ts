export interface QdrantScrollParams {
  readonly collectionName: string;
  readonly limit?: number;
  readonly offset?: unknown;
  readonly filter?: unknown;
  readonly withPayload?: boolean;
  readonly withVector?: boolean;
  readonly signal?: AbortSignal;
}

export interface QdrantQueryParams {
  readonly collectionName: string;
  readonly vector: readonly number[];
  readonly limit?: number;
  readonly filter?: unknown;
  readonly withPayload?: boolean;
  readonly withVector?: boolean;
  readonly scoreThreshold?: number;
  readonly signal?: AbortSignal;
}

export interface QdrantPointGetParams {
  readonly collectionName: string;
  readonly ids: readonly (string | number)[];
  readonly withPayload?: boolean;
  readonly withVector?: boolean;
  readonly signal?: AbortSignal;
}

export interface QdrantCountParams {
  readonly collectionName: string;
  readonly filter?: unknown;
  readonly exact?: boolean;
  readonly signal?: AbortSignal;
}

export interface QdrantUpsertParams {
  readonly collectionName: string;
  readonly points: readonly unknown[];
  readonly signal?: AbortSignal;
}

export interface QdrantClient {
  listCollections(signal?: AbortSignal): Promise<unknown>;
  getCollection(collectionName: string, signal?: AbortSignal): Promise<unknown>;
  getPoints(params: QdrantPointGetParams): Promise<unknown>;
  scrollPoints(params: QdrantScrollParams): Promise<unknown>;
  queryPoints(params: QdrantQueryParams): Promise<unknown>;
  countPoints(params: QdrantCountParams): Promise<unknown>;
  upsertPoints(params: QdrantUpsertParams): Promise<unknown>;
}
