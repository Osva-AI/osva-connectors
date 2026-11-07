export interface ConfluenceListParams {
  readonly limit?: number;
  readonly cursor?: string;
  readonly signal?: AbortSignal;
}

export type ConfluenceSpaceListParams = ConfluenceListParams;

export interface ConfluencePageListParams extends ConfluenceListParams {
  readonly spaceId: string;
}

export interface ConfluencePageChildrenListParams extends ConfluenceListParams {
  readonly pageId: string;
}

export interface ConfluenceSearchParams extends ConfluenceListParams {
  readonly cql: string;
}

export interface ConfluenceListResult {
  readonly results: unknown[];
  readonly nextCursor?: string;
}

export interface ConfluencePageCreateParams {
  readonly spaceId: string;
  readonly title: string;
  readonly bodyStorage: string;
  readonly parentId?: string;
  readonly signal?: AbortSignal;
}

export interface ConfluencePageUpdateParams {
  readonly pageId: string;
  readonly title?: string;
  readonly bodyStorage?: string;
  readonly versionNumber: number;
  readonly versionMessage?: string;
  readonly signal?: AbortSignal;
}

export interface ConfluenceClient {
  listSpaces(params: ConfluenceSpaceListParams): Promise<ConfluenceListResult>;
  getSpace(spaceId: string, signal?: AbortSignal): Promise<unknown>;
  listPages(params: ConfluencePageListParams): Promise<ConfluenceListResult>;
  getPage(pageId: string, signal?: AbortSignal): Promise<unknown>;
  listPageChildren(
    params: ConfluencePageChildrenListParams,
  ): Promise<ConfluenceListResult>;
  search(params: ConfluenceSearchParams): Promise<ConfluenceListResult>;
  createPage(params: ConfluencePageCreateParams): Promise<unknown>;
  updatePage(params: ConfluencePageUpdateParams): Promise<unknown>;
}
