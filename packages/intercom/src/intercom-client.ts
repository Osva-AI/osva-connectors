export interface IntercomListParams {
  readonly page: number;
  readonly perPage: number;
}

export interface IntercomClient {
  listConversations(
    params: IntercomListParams,
    signal?: AbortSignal,
  ): Promise<{ items: unknown }>;
  getConversation(
    conversationId: string,
    signal?: AbortSignal,
  ): Promise<unknown>;
  searchConversations(
    query: string,
    page: number,
    signal?: AbortSignal,
  ): Promise<unknown>;
  listContacts(
    params: IntercomListParams,
    signal?: AbortSignal,
  ): Promise<unknown>;
  getContact(contactId: string, signal?: AbortSignal): Promise<unknown>;
  searchContacts(
    query: string,
    page: number,
    signal?: AbortSignal,
  ): Promise<unknown>;
  listAdmins(signal?: AbortSignal): Promise<unknown>;
  addAdminNote(
    conversationId: string,
    body: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown>;
  setConversationState(
    conversationId: string,
    body: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown>;
}
