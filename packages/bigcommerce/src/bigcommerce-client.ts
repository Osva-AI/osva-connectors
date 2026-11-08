export interface BigcommerceListParams {
  readonly page: number;
  readonly limit: number;
  readonly search?: string;
}

export interface BigcommerceClient {
  listProducts(
    params: BigcommerceListParams,
    signal?: AbortSignal,
  ): Promise<{
    envelope: unknown;
  }>;
  getProduct(productId: number, signal?: AbortSignal): Promise<unknown>;
  listProductVariants(
    productId: number,
    params: BigcommerceListParams,
    signal?: AbortSignal,
  ): Promise<{
    envelope: unknown;
  }>;
  listCategoryTrees(signal?: AbortSignal): Promise<{
    envelope: unknown;
  }>;
  listCategoriesInTree(
    treeId: number,
    params: BigcommerceListParams & {
      parentId?: number;
    },
    signal?: AbortSignal,
  ): Promise<{
    envelope: unknown;
  }>;
  listOrders(
    params: BigcommerceListParams & {
      minDateCreated?: string;
      maxDateCreated?: string;
    },
    signal?: AbortSignal,
  ): Promise<unknown>;
  getOrder(orderId: number, signal?: AbortSignal): Promise<unknown>;
  listOrderProducts(orderId: number, signal?: AbortSignal): Promise<unknown>;
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
