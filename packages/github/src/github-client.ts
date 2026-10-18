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

export interface GithubRepositoryClient {
  getRepository(params: {
    owner: string;
    repo: string;
    signal?: AbortSignal;
  }): Promise<GithubRepositoryRecord>;
}
