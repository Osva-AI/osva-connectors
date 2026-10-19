import { Octokit } from "octokit";

import { DEFAULT_REQUEST_TIMEOUT_MS } from "./constants.js";
import type {
  GithubClient,
  GithubIssueCommentRecord,
  GithubIssueRecord,
  GithubRepositoryRecord,
} from "./github-client.js";
import { linkHeaderHasNextPage } from "./parse-github-link.js";

/** Per-request marker read by {@link createGithubOctokit} throttle handlers. */
export const OSVA_MUTATION_NO_AUTO_RETRY = "osvaMutationNoAutoRetry";

type OctokitThrottleHandlers = NonNullable<
  ConstructorParameters<typeof Octokit>[0]
>["throttle"];

type OctokitRequestOptions = {
  method: string;
  url: string;
  request?: Record<string, unknown>;
};

type OctokitWithLog = {
  log: {
    warn: (message: string) => void;
    info: (message: string) => void;
  };
};

function isMutationNoAutoRetry(options: OctokitRequestOptions): boolean {
  return options.request?.[OSVA_MUTATION_NO_AUTO_RETRY] === true;
}

function mutationSafeThrottleHandlers(): OctokitThrottleHandlers {
  return {
    onRateLimit(
      retryAfter: number,
      options: OctokitRequestOptions,
      octokit: OctokitWithLog,
    ) {
      octokit.log.warn(
        `Request quota exhausted for request ${options.method} ${options.url}`,
      );
      if (isMutationNoAutoRetry(options)) {
        return false;
      }
      if (options.request?.retryCount === 0) {
        octokit.log.info(`Retrying after ${retryAfter} seconds!`);
        return true;
      }
    },
    onSecondaryRateLimit(
      retryAfter: number,
      options: OctokitRequestOptions,
      octokit: OctokitWithLog,
    ) {
      octokit.log.warn(
        `SecondaryRateLimit detected for request ${options.method} ${options.url}`,
      );
      if (isMutationNoAutoRetry(options)) {
        return false;
      }
      if (options.request?.retryCount === 0) {
        octokit.log.info(`Retrying after ${retryAfter} seconds!`);
        return true;
      }
    },
  };
}

export interface CreateGithubOctokitOptions {
  readonly token: string;
  readonly baseUrl?: string;
}

/** Octokit with throttling handlers that honor {@link OSVA_MUTATION_NO_AUTO_RETRY}. */
export function createGithubOctokit(
  options: CreateGithubOctokitOptions,
): Octokit {
  return new Octokit({
    auth: options.token,
    ...(options.baseUrl !== undefined ? { baseUrl: options.baseUrl } : {}),
    throttle: mutationSafeThrottleHandlers(),
  });
}

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
    options.octokit ?? createGithubOctokit({ token: options.token });
  const timeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;

  const readRequestOptions = (signal?: AbortSignal) => ({
    signal,
    timeout: timeoutMs,
  });

  /** Disables @octokit/plugin-retry and throttling auto-retries for mutations. */
  const mutationRequestOptions = (signal?: AbortSignal) => ({
    signal,
    timeout: timeoutMs,
    retries: 0,
    [OSVA_MUTATION_NO_AUTO_RETRY]: true,
  });

  return {
    async getRepository({ owner, repo, signal }) {
      const response = await octokit.rest.repos.get({
        owner,
        repo,
        request: readRequestOptions(signal),
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
        request: readRequestOptions(signal),
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
        request: readRequestOptions(signal),
      });
      return response.data as GithubIssueRecord;
    },

    async createIssue({ owner, repo, title, body, signal }) {
      const response = await octokit.rest.issues.create({
        owner,
        repo,
        title,
        ...(body !== undefined ? { body } : {}),
        request: mutationRequestOptions(signal),
      });
      return response.data as GithubIssueRecord;
    },

    async createIssueComment({ owner, repo, issueNumber, body, signal }) {
      const response = await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body,
        request: mutationRequestOptions(signal),
      });
      return response.data as GithubIssueCommentRecord;
    },
  };
}

/** @deprecated Use {@link createOctokitGithubClient}. */
export const createOctokitRepositoryClient = createOctokitGithubClient;
