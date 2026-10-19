export interface GithubRepositoryRecord {
  readonly name: string;
  readonly full_name: string;
  readonly description: string | null;
  readonly html_url: string;
  readonly visibility?: string | null;
  readonly private?: boolean;
  readonly default_branch: string;
  readonly archived: boolean;
  readonly fork: boolean;
}

export interface GithubIssueRecord {
  readonly number: number;
  readonly title: string;
  readonly state: string;
  readonly html_url: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly closed_at: string | null;
  readonly user: { readonly login: string } | null;
  readonly labels: ReadonlyArray<{ readonly name?: string }>;
  readonly comments: number;
  readonly pull_request?: unknown;
}

export interface GithubListIssuesResult {
  readonly items: readonly GithubIssueRecord[];
  readonly page: number;
  readonly perPage: number;
  readonly hasNextPage: boolean;
}

export interface GithubClient {
  getRepository(params: {
    owner: string;
    repo: string;
    signal?: AbortSignal;
  }): Promise<GithubRepositoryRecord>;

  listIssues(params: {
    owner: string;
    repo: string;
    state: "open" | "closed" | "all";
    perPage: number;
    page: number;
    signal?: AbortSignal;
  }): Promise<GithubListIssuesResult>;

  getIssue(params: {
    owner: string;
    repo: string;
    issueNumber: number;
    signal?: AbortSignal;
  }): Promise<GithubIssueRecord>;

  createIssue(params: {
    owner: string;
    repo: string;
    title: string;
    body?: string;
    signal?: AbortSignal;
  }): Promise<GithubIssueRecord>;
}

/** @deprecated Use {@link GithubClient}. */
export type GithubRepositoryClient = GithubClient;
