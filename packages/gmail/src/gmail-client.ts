export interface GmailListMessagesParams {
  readonly signal?: AbortSignal;
  readonly maxResults: number;
  readonly pageToken?: string;
  readonly labelIds?: readonly string[];
  readonly q?: string;
  readonly includeSpamTrash?: boolean;
}

export interface GmailGetMessageParams {
  readonly signal?: AbortSignal;
  readonly messageId: string;
  readonly format: "metadata" | "full" | "minimal";
  readonly metadataHeaders?: readonly string[];
}

export interface GmailListThreadsParams {
  readonly signal?: AbortSignal;
  readonly maxResults: number;
  readonly pageToken?: string;
  readonly labelIds?: readonly string[];
  readonly q?: string;
  readonly includeSpamTrash?: boolean;
}

export interface GmailGetThreadParams {
  readonly signal?: AbortSignal;
  readonly threadId: string;
  readonly format: "metadata" | "full" | "minimal";
  readonly metadataHeaders?: readonly string[];
}

export interface GmailListDraftsParams {
  readonly signal?: AbortSignal;
  readonly maxResults: number;
  readonly pageToken?: string;
}

export interface GmailCreateDraftParams {
  readonly signal?: AbortSignal;
  readonly body: unknown;
}

export interface GmailUpdateDraftParams {
  readonly signal?: AbortSignal;
  readonly draftId: string;
  readonly body: unknown;
}

export interface GmailSendMessageParams {
  readonly signal?: AbortSignal;
  /** Gmail API body for `users.messages.send` */
  readonly body: unknown;
}

export interface GmailClient {
  getProfile(params: { readonly signal?: AbortSignal }): Promise<unknown>;
  listMessages(params: GmailListMessagesParams): Promise<unknown>;
  getMessage(params: GmailGetMessageParams): Promise<unknown>;
  listThreads(params: GmailListThreadsParams): Promise<unknown>;
  getThread(params: GmailGetThreadParams): Promise<unknown>;
  listLabels(params: { readonly signal?: AbortSignal }): Promise<unknown>;
  listDrafts(params: GmailListDraftsParams): Promise<unknown>;
  createDraft(params: GmailCreateDraftParams): Promise<unknown>;
  updateDraft(params: GmailUpdateDraftParams): Promise<unknown>;
  sendMessage(params: GmailSendMessageParams): Promise<unknown>;
}
