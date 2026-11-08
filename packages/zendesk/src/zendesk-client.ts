export interface ZendeskListParams {
  readonly limit: number;
  readonly cursor?: string;
}

export interface ZendeskSearchParams {
  readonly status?: string;
  readonly updatedSince?: string;
  readonly page: number;
  readonly limit: number;
}

export interface ZendeskClient {
  listTickets(
    params: ZendeskListParams,
    signal?: AbortSignal,
  ): Promise<{ items: unknown; nextCursor: string | undefined }>;
  searchTickets(
    params: ZendeskSearchParams,
    signal?: AbortSignal,
  ): Promise<{ items: unknown }>;
  getTicket(ticketId: number, signal?: AbortSignal): Promise<unknown>;
  listTicketComments(
    ticketId: number,
    limit: number,
    cursor: string | undefined,
    signal?: AbortSignal,
  ): Promise<{ items: unknown; nextCursor: string | undefined }>;
  getUser(userId: number, signal?: AbortSignal): Promise<unknown>;
  updateTicket(
    ticketId: number,
    body: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown>;
}
