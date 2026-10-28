export interface StripeClient {
  getAccount(params: { signal?: AbortSignal }): Promise<unknown>;

  getBalance(params: { signal?: AbortSignal }): Promise<unknown>;

  listBalanceTransactions(params: {
    limit: number;
    startingAfter?: string;
    createdGte?: number;
    createdLte?: number;
    type?: string;
    signal?: AbortSignal;
  }): Promise<unknown>;

  listPaymentIntents(params: {
    limit: number;
    startingAfter?: string;
    createdGte?: number;
    createdLte?: number;
    customer?: string;
    signal?: AbortSignal;
  }): Promise<unknown>;

  getPaymentIntent(params: {
    id: string;
    signal?: AbortSignal;
  }): Promise<unknown>;

  listCharges(params: {
    limit: number;
    startingAfter?: string;
    createdGte?: number;
    createdLte?: number;
    customer?: string;
    paymentIntent?: string;
    signal?: AbortSignal;
  }): Promise<unknown>;

  listRefunds(params: {
    limit: number;
    startingAfter?: string;
    createdGte?: number;
    createdLte?: number;
    charge?: string;
    paymentIntent?: string;
    signal?: AbortSignal;
  }): Promise<unknown>;

  listSubscriptions(params: {
    limit: number;
    startingAfter?: string;
    customer?: string;
    status?: string;
    createdGte?: number;
    createdLte?: number;
    signal?: AbortSignal;
  }): Promise<unknown>;

  listInvoices(params: {
    limit: number;
    startingAfter?: string;
    customer?: string;
    subscription?: string;
    status?: string;
    createdGte?: number;
    createdLte?: number;
    signal?: AbortSignal;
  }): Promise<unknown>;

  getCustomer(params: { id: string; signal?: AbortSignal }): Promise<unknown>;
}
