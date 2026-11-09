import type { OpenApiCatalog } from "./openapi-catalog.js";
import type { PostgrestFilterInput } from "./postgrest-filters.js";

export interface SelectRowsParams {
  readonly schema: string;
  readonly table: string;
  readonly columns: readonly string[];
  readonly filterAllowColumns?: readonly string[];
  readonly limit: number;
  readonly offset: number;
  readonly filters?: readonly PostgrestFilterInput[];
  readonly orderColumn?: string;
  readonly orderAscending?: boolean;
  readonly signal?: AbortSignal;
}

export interface SelectRowsResult {
  readonly rows: readonly Record<string, unknown>[];
  readonly rangeStart?: number;
  readonly rangeEnd?: number;
  readonly total?: number;
}

export interface CountRowsParams {
  readonly schema: string;
  readonly table: string;
  readonly filters?: readonly PostgrestFilterInput[];
  readonly exact: boolean;
  readonly signal?: AbortSignal;
}

export interface SupabaseProviderClient {
  getOpenApiCatalog(signal?: AbortSignal): Promise<OpenApiCatalog>;
  selectRows(params: SelectRowsParams): Promise<SelectRowsResult>;
  countRows(params: CountRowsParams): Promise<number>;
}
