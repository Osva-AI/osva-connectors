import {
  LIST_DEFAULT_PAGE_SIZE,
  LIST_MAX_PAGE_SIZE,
  SAMPLE_DEFAULT_ROW_LIMIT,
  SAMPLE_MAX_ROW_LIMIT,
} from "./constants.js";

export function defaultListPageSize(
  limit: number | undefined,
  fallback: number,
): number {
  if (limit === undefined) {
    return fallback;
  }
  return Math.min(Math.max(limit, 1), LIST_MAX_PAGE_SIZE);
}

export function defaultSampleRowLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return SAMPLE_DEFAULT_ROW_LIMIT;
  }
  return Math.min(Math.max(limit, 1), SAMPLE_MAX_ROW_LIMIT);
}

export function parseProviderOffset(token: string | undefined): number {
  if (token === undefined) {
    return 0;
  }
  const value = Number(token);
  if (!Number.isInteger(value) || value < 0) {
    return 0;
  }
  return value;
}

export function nextContinuationOffset(
  offset: number,
  pageSize: number,
  rowCount: number,
): string | undefined {
  if (rowCount < pageSize) {
    return undefined;
  }
  return String(offset + pageSize);
}

export function mapListResponse<T>(
  items: readonly T[],
  continuationToken?: string,
): { items: readonly T[]; continuationToken?: string } {
  return continuationToken === undefined
    ? { items }
    : { items, continuationToken };
}

export function defaultListPageSizeConstant(): number {
  return LIST_DEFAULT_PAGE_SIZE;
}
