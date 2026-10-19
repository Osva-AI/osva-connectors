import { vi } from "vitest";

import type {
  GithubClient,
  GithubIssueRecord,
  GithubListIssuesResult,
  GithubRepositoryRecord,
} from "../../src/github-client.js";

export const sampleRepository: GithubRepositoryRecord = {
  name: "osva",
  full_name: "Osva-AI/osva",
  description: "OSVA core repository",
  html_url: "https://github.com/Osva-AI/osva",
  visibility: "public",
  private: false,
  default_branch: "main",
  archived: false,
  fork: false,
};

export const sampleIssue: GithubIssueRecord = {
  number: 42,
  title: "Example issue",
  state: "open",
  html_url: "https://github.com/Osva-AI/osva/issues/42",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-02T00:00:00Z",
  closed_at: null,
  user: { login: "octocat" },
  labels: [{ name: "bug" }],
  comments: 3,
};

export const samplePullRequest: GithubIssueRecord = {
  ...sampleIssue,
  number: 99,
  title: "Example pull request",
  html_url: "https://github.com/Osva-AI/osva/pull/99",
  pull_request: { url: "https://api.github.com/repos/Osva-AI/osva/pulls/99" },
};

export function createMockGithubClient(
  implementation?: Partial<GithubClient>,
): GithubClient & {
  getRepository: ReturnType<typeof vi.fn>;
  listIssues: ReturnType<typeof vi.fn>;
  getIssue: ReturnType<typeof vi.fn>;
  createIssue: ReturnType<typeof vi.fn>;
} {
  const defaultListResult: GithubListIssuesResult = {
    items: [sampleIssue],
    page: 1,
    perPage: 20,
    hasNextPage: false,
  };

  const getRepository = vi.fn(
    implementation?.getRepository ?? (async () => sampleRepository),
  );
  const listIssues = vi.fn(
    implementation?.listIssues ?? (async () => defaultListResult),
  );
  const getIssue = vi.fn(implementation?.getIssue ?? (async () => sampleIssue));
  const createIssue = vi.fn(
    implementation?.createIssue ?? (async () => sampleIssue),
  );

  return {
    getRepository,
    listIssues,
    getIssue,
    createIssue,
  };
}
