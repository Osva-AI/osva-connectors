export interface WoocommerceListParams {
  readonly page: number;
  readonly perPage: number;
  readonly search?: string;
  readonly status?: string;
  readonly category?: number;
  readonly parent?: number;
  readonly after?: string;
  readonly before?: string;
}

export interface WoocommerceClient {
  listProducts(
    params: WoocommerceListParams,
    signal?: AbortSignal,
  ): Promise<{
    items: unknown;
    headers: Headers;
  }>;
  getProduct(productId: number, signal?: AbortSignal): Promise<unknown>;
  listProductVariations(
    productId: number,
    params: Pick<WoocommerceListParams, "page" | "perPage">,
    signal?: AbortSignal,
  ): Promise<{
    items: unknown;
    headers: Headers;
  }>;
  getProductVariation(
    productId: number,
    variationId: number,
    signal?: AbortSignal,
  ): Promise<unknown>;
  listCategories(
    params: WoocommerceListParams,
    signal?: AbortSignal,
  ): Promise<{
    items: unknown;
    headers: Headers;
  }>;
  listOrders(
    params: WoocommerceListParams,
    signal?: AbortSignal,
  ): Promise<{
    items: unknown;
    headers: Headers;
  }>;
  getOrder(orderId: number, signal?: AbortSignal): Promise<unknown>;
  listOrderNotes(
    orderId: number,
    params: Pick<WoocommerceListParams, "page" | "perPage">,
    signal?: AbortSignal,
  ): Promise<{
    items: unknown;
    headers: Headers;
  }>;
  updateProduct(
    productId: number,
    body: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown>;
  updateOrderStatus(
    orderId: number,
    body: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown>;
}
