export interface AzureBlobBucketSummary {
  readonly name: string;
  readonly creationDate?: string;
}

export interface AzureBlobObjectSummary {
  readonly key: string;
  readonly size?: number;
  readonly lastModified?: string;
  readonly etag?: string;
}

export interface AzureBlobBucketListResult {
  readonly buckets: readonly AzureBlobBucketSummary[];
  readonly continuationToken?: string;
}

export interface AzureBlobObjectListResult {
  readonly objects: readonly AzureBlobObjectSummary[];
  readonly continuationToken?: string;
  readonly prefix?: string;
}

export interface AzureBlobObjectVersionSummary {
  readonly key: string;
  readonly versionId?: string;
  readonly isLatest?: boolean;
  readonly size?: number;
  readonly lastModified?: string;
  readonly etag?: string;
}

export interface AzureBlobObjectVersionsListResult {
  readonly versions: readonly AzureBlobObjectVersionSummary[];
  readonly continuationToken?: string;
  readonly prefix?: string;
}

export interface AzureBlobObjectMetadata {
  readonly key: string;
  readonly bucket: string;
  readonly size?: number;
  readonly lastModified?: string;
  readonly etag?: string;
  readonly contentType?: string;
  readonly contentEncoding?: string;
}

export interface AzureBlobObjectReadOptions {
  readonly maxBytes: number;
  readonly signal?: AbortSignal;
}

export interface AzureBlobObjectReadResult {
  readonly metadata: AzureBlobObjectMetadata;
  readonly body: Uint8Array;
}

export interface AzureBlobWriteResult {
  readonly bucket: string;
  readonly key: string;
  readonly etag?: string;
}

export interface AzureBlobProviderClient {
  listBuckets(params: {
    continuationToken?: string;
    maxResults: number;
  }): Promise<AzureBlobBucketListResult>;

  headBucket(bucket: string): Promise<{ region?: string }>;

  listObjects(params: {
    bucket: string;
    prefix: string;
    maxKeys: number;
    continuationToken?: string;
  }): Promise<AzureBlobObjectListResult>;

  headObject(bucket: string, key: string): Promise<AzureBlobObjectMetadata>;

  getObject(
    bucket: string,
    key: string,
    options: AzureBlobObjectReadOptions,
  ): Promise<AzureBlobObjectReadResult>;

  listObjectVersions(params: {
    bucket: string;
    prefix: string;
    maxKeys: number;
    continuationToken?: string;
  }): Promise<AzureBlobObjectVersionsListResult>;

  createObject(params: {
    bucket: string;
    key: string;
    body: Uint8Array;
    contentType: string;
  }): Promise<AzureBlobWriteResult>;

  replaceObject(params: {
    bucket: string;
    key: string;
    body: Uint8Array;
    contentType: string;
    expectedETag: string;
  }): Promise<AzureBlobWriteResult>;
}
