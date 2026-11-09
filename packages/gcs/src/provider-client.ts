export interface GcsBucketSummary {
  readonly name: string;
  readonly creationDate?: string;
}

export interface GcsObjectSummary {
  readonly key: string;
  readonly size?: number;
  readonly lastModified?: string;
  readonly etag?: string;
}

export interface GcsBucketListResult {
  readonly buckets: readonly GcsBucketSummary[];
  readonly continuationToken?: string;
}

export interface GcsObjectListResult {
  readonly objects: readonly GcsObjectSummary[];
  readonly continuationToken?: string;
  readonly prefix?: string;
}

export interface GcsObjectVersionSummary {
  readonly key: string;
  readonly generation?: string;
  readonly isLatest?: boolean;
  readonly size?: number;
  readonly lastModified?: string;
  readonly etag?: string;
}

export interface GcsObjectVersionsListResult {
  readonly versions: readonly GcsObjectVersionSummary[];
  readonly continuationToken?: string;
  readonly prefix?: string;
}

export interface GcsObjectMetadata {
  readonly key: string;
  readonly bucket: string;
  readonly size?: number;
  readonly lastModified?: string;
  readonly etag?: string;
  readonly contentType?: string;
  readonly contentEncoding?: string;
  readonly generation?: string;
}

export interface GcsObjectReadOptions {
  readonly maxBytes: number;
  readonly signal?: AbortSignal;
}

export interface GcsObjectReadResult {
  readonly metadata: GcsObjectMetadata;
  readonly body: Uint8Array;
}

export interface GcsWriteResult {
  readonly bucket: string;
  readonly key: string;
  readonly etag?: string;
  readonly generation?: string;
}

export interface GcsProviderClient {
  listBuckets(params: {
    continuationToken?: string;
    maxResults: number;
  }): Promise<GcsBucketListResult>;

  headBucket(bucket: string): Promise<{ region?: string }>;

  listObjects(params: {
    bucket: string;
    prefix: string;
    maxKeys: number;
    continuationToken?: string;
  }): Promise<GcsObjectListResult>;

  headObject(bucket: string, key: string): Promise<GcsObjectMetadata>;

  getObject(
    bucket: string,
    key: string,
    options: GcsObjectReadOptions,
  ): Promise<GcsObjectReadResult>;

  listObjectVersions(params: {
    bucket: string;
    prefix: string;
    maxKeys: number;
    continuationToken?: string;
  }): Promise<GcsObjectVersionsListResult>;

  createObject(params: {
    bucket: string;
    key: string;
    body: Uint8Array;
    contentType: string;
  }): Promise<GcsWriteResult>;

  replaceObject(params: {
    bucket: string;
    key: string;
    body: Uint8Array;
    contentType: string;
    expectedGeneration: string;
  }): Promise<GcsWriteResult>;
}
