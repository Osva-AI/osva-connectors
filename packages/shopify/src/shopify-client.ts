export interface ShopifyPageInfo {
  readonly hasNextPage: boolean;
  readonly endCursor: string | null;
}

export interface ShopifyGraphqlRequest {
  readonly query: string;
  readonly variables?: Record<string, unknown>;
  readonly signal?: AbortSignal;
}

export interface ShopifyClient {
  executeGraphql<TData>(request: ShopifyGraphqlRequest): Promise<TData>;

  getShop(params: { signal?: AbortSignal }): Promise<unknown>;

  listProducts(params: {
    limit: number;
    cursor?: string;
    query?: string;
    signal?: AbortSignal;
  }): Promise<unknown>;

  getProduct(params: { id: string; signal?: AbortSignal }): Promise<unknown>;

  listOrders(params: {
    limit: number;
    cursor?: string;
    query?: string;
    signal?: AbortSignal;
  }): Promise<unknown>;

  getOrder(params: { id: string; signal?: AbortSignal }): Promise<unknown>;

  listLocations(params: {
    limit: number;
    cursor?: string;
    signal?: AbortSignal;
  }): Promise<unknown>;

  listInventoryLevels(params: {
    locationId?: string;
    inventoryItemId?: string;
    limit: number;
    cursor?: string;
    signal?: AbortSignal;
  }): Promise<unknown>;
}
