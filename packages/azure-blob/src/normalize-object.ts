import type {
  AzureBlobObjectListResult,
  AzureBlobObjectMetadata,
  AzureBlobObjectVersionsListResult,
} from "./provider-client.js";

export function mapContainerListResponse(
  result: { containers: readonly { name: string }[] },
  continuationToken?: string,
): Record<string, unknown> {
  return {
    containers: result.containers,
    ...(continuationToken !== undefined ? { continuationToken } : {}),
  };
}

export function mapObjectListResponse(
  result: AzureBlobObjectListResult,
  continuationToken?: string,
): Record<string, unknown> {
  return {
    objects: result.objects,
    ...(result.prefix !== undefined && result.prefix.length > 0
      ? { prefix: result.prefix }
      : {}),
    ...(continuationToken !== undefined ? { continuationToken } : {}),
  };
}

export function mapObjectMetadataResponse(
  metadata: AzureBlobObjectMetadata,
): Record<string, unknown> {
  return {
    container: metadata.bucket,
    key: metadata.key,
    ...(metadata.size !== undefined ? { size: metadata.size } : {}),
    ...(metadata.lastModified !== undefined
      ? { lastModified: metadata.lastModified }
      : {}),
    ...(metadata.etag !== undefined ? { etag: metadata.etag } : {}),
    ...(metadata.contentType !== undefined
      ? { contentType: metadata.contentType }
      : {}),
  };
}

export function defaultListPageSize(
  limit: number | undefined,
  fallback: number,
): number {
  return limit ?? fallback;
}

export function mapObjectVersionsListResponse(
  result: AzureBlobObjectVersionsListResult,
  continuationToken?: string,
): Record<string, unknown> {
  return {
    versions: result.versions,
    pageInfo: {
      hasMore: continuationToken !== undefined,
      ...(continuationToken !== undefined ? { continuationToken } : {}),
      returnedCount: result.versions.length,
    },
    ...(result.prefix !== undefined && result.prefix.length > 0
      ? { prefix: result.prefix }
      : {}),
  };
}
