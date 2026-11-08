export interface FreshdeskListParams {
  readonly page: number;
  readonly perPage: number;
}

export interface FreshdeskClient {
  listTickets(
    params: FreshdeskListParams,
    signal?: AbortSignal,
  ): Promise<{ items: unknown }>;
  getTicket(ticketId: number, signal?: AbortSignal): Promise<unknown>;
  searchTickets(
    query: string,
    page: number,
    signal?: AbortSignal,
  ): Promise<unknown>;
  listTicketConversations(
    ticketId: number,
    signal?: AbortSignal,
  ): Promise<unknown>;
  listContacts(
    params: FreshdeskListParams,
    signal?: AbortSignal,
  ): Promise<unknown>;
  getContact(contactId: number, signal?: AbortSignal): Promise<unknown>;
  addPrivateNote(
    ticketId: number,
    body: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown>;
  setTicketStatus(
    ticketId: number,
    body: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown>;
}
