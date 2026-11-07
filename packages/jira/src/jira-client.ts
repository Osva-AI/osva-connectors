export interface JiraProjectSearchParams {
  readonly startAt: number;
  readonly maxResults: number;
  readonly signal?: AbortSignal;
}

export interface JiraProjectSearchResult {
  readonly values: unknown[];
  readonly total?: number;
  readonly isLast?: boolean;
  readonly nextPageToken?: string;
}

export interface JiraIssueSearchParams {
  readonly jql: string;
  readonly maxResults: number;
  readonly nextPageToken?: string;
  readonly fields?: readonly string[];
  readonly signal?: AbortSignal;
}

export interface JiraIssueSearchResult {
  readonly issues: unknown[];
  readonly nextPageToken?: string;
  readonly isLast?: boolean;
}

export interface JiraIssueCreateParams {
  readonly projectKey: string;
  readonly issueTypeId: string;
  readonly summary: string;
  readonly descriptionAdf?: unknown;
  readonly additionalFields?: Record<string, unknown>;
  readonly signal?: AbortSignal;
}

export interface JiraIssueUpdateParams {
  readonly issueKey: string;
  readonly summary?: string;
  readonly descriptionAdf?: unknown;
  readonly additionalFields?: Record<string, unknown>;
  readonly signal?: AbortSignal;
}

export interface JiraIssueCommentCreateParams {
  readonly issueKey: string;
  readonly bodyAdf: unknown;
  readonly signal?: AbortSignal;
}

export interface JiraIssueTransitionParams {
  readonly issueKey: string;
  readonly transitionId: string;
  readonly fields?: Record<string, unknown>;
  readonly signal?: AbortSignal;
}

export interface JiraClient {
  searchProjects(
    params: JiraProjectSearchParams,
  ): Promise<JiraProjectSearchResult>;
  getProject(projectIdOrKey: string, signal?: AbortSignal): Promise<unknown>;
  searchIssues(params: JiraIssueSearchParams): Promise<JiraIssueSearchResult>;
  getIssue(issueKey: string, signal?: AbortSignal): Promise<unknown>;
  listIssueTransitions(
    issueKey: string,
    signal?: AbortSignal,
  ): Promise<unknown>;
  createIssue(params: JiraIssueCreateParams): Promise<unknown>;
  updateIssue(params: JiraIssueUpdateParams): Promise<unknown>;
  createIssueComment(params: JiraIssueCommentCreateParams): Promise<unknown>;
  transitionIssue(params: JiraIssueTransitionParams): Promise<unknown>;
}
