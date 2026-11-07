export interface NotionSearchParams {
  readonly query?: string;
  readonly pageSize: number;
  readonly startCursor?: string;
  readonly filter?: { readonly value: "page" | "database" | "data_source" };
  readonly signal?: AbortSignal;
}

export interface NotionListChildrenParams {
  readonly blockId: string;
  readonly pageSize: number;
  readonly startCursor?: string;
  readonly signal?: AbortSignal;
}

export interface NotionDataSourceQueryParams {
  readonly dataSourceId: string;
  readonly pageSize: number;
  readonly startCursor?: string;
  readonly filter?: unknown;
  readonly sorts?: unknown;
  readonly filterProperties?: readonly string[];
  readonly signal?: AbortSignal;
}

export interface NotionPageCreateParams {
  readonly parent:
    | { readonly type: "page_id"; readonly pageId: string }
    | { readonly type: "database_id"; readonly databaseId: string }
    | { readonly type: "data_source_id"; readonly dataSourceId: string };
  readonly properties?: unknown;
  readonly children?: unknown;
  readonly signal?: AbortSignal;
}

export interface NotionPageUpdateParams {
  readonly pageId: string;
  readonly properties?: unknown;
  readonly inTrash?: boolean;
  readonly signal?: AbortSignal;
}

export type NotionBlockAppendPosition =
  | { readonly type: "end" }
  | { readonly type: "start" }
  | { readonly type: "after_block"; readonly afterBlockId: string };

export interface NotionAppendChildrenParams {
  readonly blockId: string;
  readonly children: readonly unknown[];
  readonly position?: NotionBlockAppendPosition;
  readonly signal?: AbortSignal;
}

export interface NotionSearchResult {
  readonly results: unknown[];
  readonly hasMore: boolean;
  readonly nextCursor?: string;
  readonly requestStatus?: unknown;
}

export interface NotionListChildrenResult {
  readonly results: unknown[];
  readonly hasMore: boolean;
  readonly nextCursor?: string;
}

export interface NotionClient {
  search(params: NotionSearchParams): Promise<NotionSearchResult>;
  getPage(pageId: string, signal?: AbortSignal): Promise<unknown>;
  listBlockChildren(
    params: NotionListChildrenParams,
  ): Promise<NotionListChildrenResult>;
  getDatabase(databaseId: string, signal?: AbortSignal): Promise<unknown>;
  getDataSource(dataSourceId: string, signal?: AbortSignal): Promise<unknown>;
  queryDataSource(
    params: NotionDataSourceQueryParams,
  ): Promise<NotionSearchResult>;
  createPage(params: NotionPageCreateParams): Promise<unknown>;
  updatePage(params: NotionPageUpdateParams): Promise<unknown>;
  appendBlockChildren(params: NotionAppendChildrenParams): Promise<unknown>;
}
