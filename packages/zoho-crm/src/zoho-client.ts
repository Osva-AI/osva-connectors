export interface ZohoListParams {
  readonly page: number;
  readonly perPage: number;
}

export interface ZohoClient {
  listLeads(params: ZohoListParams, signal?: AbortSignal): Promise<unknown>;
  getLead(leadId: string, signal?: AbortSignal): Promise<unknown>;
  listAccounts(params: ZohoListParams, signal?: AbortSignal): Promise<unknown>;
  getAccount(accountId: string, signal?: AbortSignal): Promise<unknown>;
  listContacts(params: ZohoListParams, signal?: AbortSignal): Promise<unknown>;
  getContact(contactId: string, signal?: AbortSignal): Promise<unknown>;
  listDeals(params: ZohoListParams, signal?: AbortSignal): Promise<unknown>;
  getDeal(dealId: string, signal?: AbortSignal): Promise<unknown>;
  listDealStageFields(signal?: AbortSignal): Promise<unknown>;
  setDealStage(
    dealId: string,
    body: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown>;
  addDealNote(
    dealId: string,
    body: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown>;
}
