export interface S3BucketSummary {
  readonly name: string;
  readonly creationDate?: string;
}

export interface S3ObjectSummary {
  readonly key: string;
  readonly size?: number;
  readonly lastModified?: string;
  readonly etag?: string;
}

export interface S3BucketListResult {
  readonly buckets: readonly S3BucketSummary[];
  readonly continuationToken?: string;
}

export interface S3ObjectListResult {
  readonly objects: readonly S3ObjectSummary[];
  readonly continuationToken?: string;
  readonly prefix?: string;
}

export interface S3ObjectVersionSummary {
  readonly key: string;
  readonly versionId?: string;
  readonly isLatest?: boolean;
  readonly isDeleteMarker?: boolean;
  readonly size?: number;
  readonly lastModified?: string;
  readonly etag?: string;
}

export interface S3ObjectVersionsListResult {
  readonly versions: readonly S3ObjectVersionSummary[];
  readonly continuationToken?: string;
  readonly prefix?: string;
}

export interface S3ObjectMetadata {
  readonly key: string;
  readonly bucket: string;
  readonly size?: number;
  readonly lastModified?: string;
  readonly etag?: string;
  readonly contentType?: string;
  readonly contentEncoding?: string;
}

export interface S3ObjectReadOptions {
  readonly maxBytes: number;
  readonly signal?: AbortSignal;
}

export interface S3ObjectReadResult {
  readonly metadata: S3ObjectMetadata;
  readonly body: Uint8Array;
}

export interface S3WriteResult {
  readonly bucket: string;
  readonly key: string;
  readonly etag?: string;
}

export interface S3ProviderClient {
  listBuckets(params: {
    continuationToken?: string;
    maxResults: number;
  }): Promise<S3BucketListResult>;

  headBucket(bucket: string): Promise<{ region?: string }>;

  listObjects(params: {
    bucket: string;
    prefix: string;
    maxKeys: number;
    continuationToken?: string;
  }): Promise<S3ObjectListResult>;

  headObject(bucket: string, key: string): Promise<S3ObjectMetadata>;

  getObject(
    bucket: string,
    key: string,
    options: S3ObjectReadOptions,
  ): Promise<S3ObjectReadResult>;

  listObjectVersions(params: {
    bucket: string;
    prefix: string;
    maxKeys: number;
    continuationToken?: string;
  }): Promise<S3ObjectVersionsListResult>;

  createObject(params: {
    bucket: string;
    key: string;
    body: Uint8Array;
    contentType: string;
  }): Promise<S3WriteResult>;

  replaceObject(params: {
    bucket: string;
    key: string;
    body: Uint8Array;
    contentType: string;
    expectedETag: string;
  }): Promise<S3WriteResult>;
}
