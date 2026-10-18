import { Octokit } from "octokit";

import { DEFAULT_REQUEST_TIMEOUT_MS } from "./constants.js";
import type { GithubRepositoryClient } from "./github-client.js";

export interface CreateOctokitRepositoryClientOptions {
  readonly token: string;
  readonly requestTimeoutMs?: number;
  readonly octokit?: Octokit;
}

export function createOctokitRepositoryClient(
  options: CreateOctokitRepositoryClientOptions,
): GithubRepositoryClient {
  const octokit =
    options.octokit ??
    new Octokit({
      auth: options.token,
    });
  const timeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;

  return {
    async getRepository({ owner, repo, signal }) {
      const response = await octokit.rest.repos.get({
        owner,
        repo,
        request: {
          signal,
          timeout: timeoutMs,
        },
      });
      return response.data;
    },
  };
}
