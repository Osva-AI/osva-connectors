export type ExaSearchType = "auto" | "lite" | "deep" | "deep-lite";

export interface ExaSearchParams {
  readonly query: string;
  readonly numResults?: number;
  readonly type?: ExaSearchType;
  readonly includeDomains?: readonly string[];
  readonly excludeDomains?: readonly string[];
  readonly category?: string;
  readonly includeText?: boolean;
  readonly includeHighlights?: boolean;
  readonly signal?: AbortSignal;
}

export interface ExaContentsParams {
  readonly urls: readonly string[];
  readonly includeText?: boolean;
  readonly includeHighlights?: boolean;
  readonly signal?: AbortSignal;
}

export type ExaAnswerModel = "exa" | "exa-pro" | "exa-research" | "exa-fast";

export interface ExaAnswerParams {
  readonly query: string;
  readonly model?: ExaAnswerModel;
  readonly includeCitationText?: boolean;
  readonly signal?: AbortSignal;
}

export interface ExaClient {
  search(params: ExaSearchParams): Promise<unknown>;
  getContents(params: ExaContentsParams): Promise<unknown>;
  answer(params: ExaAnswerParams): Promise<unknown>;
}
