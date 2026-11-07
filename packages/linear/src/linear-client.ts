export interface LinearPageInfo {
  readonly hasNextPage: boolean;
  readonly endCursor: string | null;
}

export interface LinearListResult<TNode> {
  readonly nodes: readonly TNode[];
  readonly pageInfo: LinearPageInfo;
}

export interface LinearViewerGetParams {
  readonly signal?: AbortSignal;
}

export interface LinearTeamListParams {
  readonly first: number;
  readonly after?: string;
  readonly signal?: AbortSignal;
}

export interface LinearIssueListParams {
  readonly first: number;
  readonly after?: string;
  readonly teamId?: string;
  readonly projectId?: string;
  readonly signal?: AbortSignal;
}

export interface LinearIssueGetParams {
  readonly issueId: string;
  readonly signal?: AbortSignal;
}

export interface LinearIssueSearchParams {
  readonly query: string;
  readonly first: number;
  readonly after?: string;
  readonly signal?: AbortSignal;
}

export interface LinearProjectListParams {
  readonly first: number;
  readonly after?: string;
  readonly teamId?: string;
  readonly signal?: AbortSignal;
}

export interface LinearProjectGetParams {
  readonly projectId: string;
  readonly signal?: AbortSignal;
}

export interface LinearIssueCreateParams {
  readonly teamId: string;
  readonly title: string;
  readonly description?: string;
  readonly projectId?: string;
  readonly signal?: AbortSignal;
}

export interface LinearIssueUpdateParams {
  readonly issueId: string;
  readonly title?: string;
  readonly description?: string;
  readonly stateId?: string;
  readonly signal?: AbortSignal;
}

export interface LinearCommentCreateParams {
  readonly issueId: string;
  readonly body: string;
  readonly signal?: AbortSignal;
}

export interface LinearClient {
  getViewer(params: LinearViewerGetParams): Promise<unknown>;

  listTeams(params: LinearTeamListParams): Promise<LinearListResult<unknown>>;

  listIssues(params: LinearIssueListParams): Promise<LinearListResult<unknown>>;

  getIssue(params: LinearIssueGetParams): Promise<unknown>;

  searchIssues(
    params: LinearIssueSearchParams,
  ): Promise<LinearListResult<unknown>>;

  listProjects(
    params: LinearProjectListParams,
  ): Promise<LinearListResult<unknown>>;

  getProject(params: LinearProjectGetParams): Promise<unknown>;

  createIssue(params: LinearIssueCreateParams): Promise<unknown>;

  updateIssue(params: LinearIssueUpdateParams): Promise<unknown>;

  createComment(params: LinearCommentCreateParams): Promise<unknown>;
}
