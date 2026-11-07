export interface OutlookListParams {
  readonly top: number;
  readonly nextLink?: string;
  readonly signal?: AbortSignal;
}

export interface OutlookMessageListParams extends OutlookListParams {
  readonly mailFolderId: string;
}

export interface OutlookMessageGetParams {
  readonly messageId: string;
  readonly signal?: AbortSignal;
}

export interface OutlookMessageSearchParams extends OutlookListParams {
  readonly query: string;
}

export interface OutlookEventListParams extends OutlookListParams {
  readonly calendarId: string;
}

export interface OutlookEventGetParams {
  readonly eventId: string;
  readonly signal?: AbortSignal;
}

export interface OutlookSendMailParams {
  readonly body: unknown;
  readonly signal?: AbortSignal;
}

export interface OutlookEventCreateParams {
  readonly calendarId: string;
  readonly body: unknown;
  readonly signal?: AbortSignal;
}

export interface OutlookClient {
  listMailFolders(params: OutlookListParams): Promise<unknown>;
  listMessages(params: OutlookMessageListParams): Promise<unknown>;
  getMessage(params: OutlookMessageGetParams): Promise<unknown>;
  searchMessages(params: OutlookMessageSearchParams): Promise<unknown>;
  listCalendars(params: OutlookListParams): Promise<unknown>;
  listEvents(params: OutlookEventListParams): Promise<unknown>;
  getEvent(params: OutlookEventGetParams): Promise<unknown>;
  sendMail(params: OutlookSendMailParams): Promise<unknown>;
  createEvent(params: OutlookEventCreateParams): Promise<unknown>;
}
