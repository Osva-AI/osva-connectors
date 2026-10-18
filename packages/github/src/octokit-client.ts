import { Octokit } from "octokit";

import { DEFAULT_REQUEST_TIMEOUT_MS } from "./constants.js";
import type {
  GithubClient,
  GithubIssueRecord,
  GithubRepositoryRecord,
} from "./github-client.js";
import { linkHeaderHasNextPage } from "./parse-github-link.js";

export interface CreateOctokitGithubClientOptions {
  readonly token: string;
  readonly requestTimeoutMs?: number;
  readonly octokit?: Octokit;
}

/** @deprecated Use {@link CreateOctokitGithubClientOptions}. */
export type CreateOctokitRepositoryClientOptions =
  CreateOctokitGithubClientOptions;

function readLinkHeader(headers: unknown): string | undefined {
  if (headers === null || typeof headers !== "object") {
    return undefined;
  }
  const record = headers as Record<string, unknown>;
  const link = record.link ?? record.Link;
  return typeof link === "string" ? link : undefined;
}

export function createOctokitGithubClient(
  options: CreateOctokitGithubClientOptions,
): GithubClient {
  const octokit =
    options.octokit ??
    new Octokit({
      auth: options.token,
    });
  const timeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;

  const requestOptions = (signal?: AbortSignal) => ({
    signal,
    timeout: timeoutMs,
  });

  return {
    async getRepository({ owner, repo, signal }) {
      const response = await octokit.rest.repos.get({
        owner,
        repo,
        request: requestOptions(signal),
      });
      return response.data as GithubRepositoryRecord;
    },

    async listIssues({ owner, repo, state, perPage, page, signal }) {
      const response = await octokit.rest.issues.listForRepo({
        owner,
        repo,
        state,
        per_page: perPage,
        page,
        request: requestOptions(signal),
      });
      const link = readLinkHeader(response.headers);
      return {
        items: response.data as GithubIssueRecord[],
        page,
        perPage,
        hasNextPage: linkHeaderHasNextPage(link),
      };
    },

    async getIssue({ owner, repo, issueNumber, signal }) {
      const response = await octokit.rest.issues.get({
        owner,
        repo,
        issue_number: issueNumber,
        request: requestOptions(signal),
      });
      return response.data as GithubIssueRecord;
    },
  };
}

/** @deprecated Use {@link createOctokitGithubClient}. */
export const createOctokitRepositoryClient = createOctokitGithubClient;
