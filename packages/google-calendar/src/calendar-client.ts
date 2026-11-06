export interface CalendarListParams {
  readonly signal?: AbortSignal;
  readonly maxResults: number;
  readonly pageToken?: string;
}

export interface EventListParams {
  readonly signal?: AbortSignal;
  readonly calendarId: string;
  readonly maxResults: number;
  readonly pageToken?: string;
  readonly timeMin?: string;
  readonly timeMax?: string;
  readonly singleEvents?: boolean;
  readonly orderBy?: "startTime" | "updated";
  readonly q?: string;
}

export interface EventGetParams {
  readonly signal?: AbortSignal;
  readonly calendarId: string;
  readonly eventId: string;
}

export interface FreeBusyQueryParams {
  readonly signal?: AbortSignal;
  readonly body: unknown;
}

export interface EventCreateParams {
  readonly signal?: AbortSignal;
  readonly calendarId: string;
  readonly body: unknown;
  readonly sendUpdates?: "all" | "externalOnly" | "none";
}

export interface EventUpdateParams {
  readonly signal?: AbortSignal;
  readonly calendarId: string;
  readonly eventId: string;
  readonly body: unknown;
  readonly sendUpdates?: "all" | "externalOnly" | "none";
}

export interface EventDeleteParams {
  readonly signal?: AbortSignal;
  readonly calendarId: string;
  readonly eventId: string;
  readonly sendUpdates?: "all" | "externalOnly" | "none";
}

export interface CalendarClient {
  listCalendars(params: CalendarListParams): Promise<unknown>;
  listEvents(params: EventListParams): Promise<unknown>;
  getEvent(params: EventGetParams): Promise<unknown>;
  queryFreeBusy(params: FreeBusyQueryParams): Promise<unknown>;
  createEvent(params: EventCreateParams): Promise<unknown>;
  updateEvent(params: EventUpdateParams): Promise<unknown>;
  deleteEvent(params: EventDeleteParams): Promise<unknown>;
}
