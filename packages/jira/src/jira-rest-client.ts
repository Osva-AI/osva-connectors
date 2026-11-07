import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  ATLASSIAN_API_HOST,
  MAX_HTTP_RESPONSE_BYTES,
  READ_ONLY_MAX_RETRIES,
  READ_ONLY_RETRY_DELAY_MS,
} from "./constants.js";
import {
  parseIssueKey,
  parseProjectKey,
  validateNextPageToken,
} from "./jira-id.js";
import type {
  JiraClient,
  JiraIssueCommentCreateParams,
  JiraIssueCreateParams,
  JiraIssueSearchParams,
  JiraIssueSearchResult,
  JiraIssueTransitionParams,
  JiraIssueUpdateParams,
  JiraProjectSearchParams,
  JiraProjectSearchResult,
} from "./jira-client.js";

export interface JiraHttpError {
  readonly kind: "http";
  readonly status: number;
  readonly jiraErrorMessages?: readonly string[];
  readonly jiraErrors?: Record<string, string>;
  readonly retryAfterMs?: number;
}

interface JiraErrorBody {
  readonly errorMessages?: string[];
  readonly errors?: Record<string, string>;
}

export interface CreateJiraRestClientOptions {
  readonly apiBasePath: string;
  readonly authorizationHeader: string;
  readonly requestTimeoutMs: number;
  readonly apiHost?: string;
  readonly fetchImpl?: typeof fetch;
}

const PRODUCTION_ATLASSIAN_HOST = "api.atlassian.com";

function assertAllowedApiUrl(url: string, apiHost: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Jira request URL is invalid.",
    );
  }

  const onApi =
    url === apiHost ||
    url.startsWith(`${apiHost}/`) ||
    url.startsWith(`${apiHost.replace(/\/$/, "")}/`);
  if (!onApi) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Jira request URL is not allowed.",
    );
  }

  if (apiHost.startsWith(ATLASSIAN_API_HOST)) {
    if (parsed.protocol !== "https:") {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Jira request URL is not allowed.",
      );
    }
    if (parsed.hostname !== PRODUCTION_ATLASSIAN_HOST) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Jira request URL is not allowed.",
      );
    }
    return;
  }

  if (parsed.hostname.endsWith(".atlassian.net")) {
    if (parsed.protocol !== "https:") {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Jira request URL is not allowed.",
      );
    }
    return;
  }

  if (
    parsed.hostname !== "127.0.0.1" &&
    parsed.hostname !== "localhost" &&
    parsed.protocol !== "http:"
  ) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Jira request URL is not allowed.",
    );
  }
}

async function readBoundedResponseText(
  response: Response,
  maxBytes: number,
  signal?: AbortSignal,
): Promise<string> {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
  const lengthHeader = response.headers.get("content-length");
  if (lengthHeader !== null) {
    const declared = Number(lengthHeader);
    if (Number.isFinite(declared) && declared > maxBytes) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Jira response exceeds the connector size limit.",
      );
    }
  }

  if (response.body === null) {
    return "";
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    if (signal?.aborted) {
      await reader.cancel();
      throw new DOMException("Aborted", "AbortError");
    }
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (value === undefined) {
      continue;
    }
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Jira response exceeds the connector size limit.",
      );
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

function parseJiraErrorBody(text: string): JiraErrorBody | undefined {
  try {
    return JSON.parse(text) as JiraErrorBody;
  } catch {
    return undefined;
  }
}

function sleepMs(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function parseRetryAfterMs(response: Response): number | undefined {
  const header = response.headers.get("retry-after");
  if (header === null) {
    return undefined;
  }
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1_000, 30_000);
  }
  return undefined;
}

function isRetryableHttpError(error: unknown): boolean {
  if (
    error !== null &&
    typeof error === "object" &&
    "kind" in error &&
    (error as JiraHttpError).kind === "http"
  ) {
    const status = (error as JiraHttpError).status;
    return status === 429 || status >= 500;
  }
  return false;
}

function isRetryableNetworkError(error: unknown): boolean {
  return (
    error instanceof TypeError ||
    (error instanceof Error &&
      (error.message.includes("fetch") || error.message.includes("network")))
  );
}

function parseIssueSearchResponse(body: unknown): JiraIssueSearchResult {
  if (body === null || typeof body !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Jira returned an unexpected payload.",
    );
  }
  const record = body as Record<string, unknown>;
  const issues = record.issues;
  if (!Array.isArray(issues)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Jira returned an unexpected payload.",
    );
  }
  const nextPageToken =
    typeof record.nextPageToken === "string" && record.nextPageToken.length > 0
      ? record.nextPageToken
      : undefined;
  return {
    issues,
    ...(nextPageToken !== undefined ? { nextPageToken } : {}),
    ...(record.isLast === true ? { isLast: true } : {}),
  };
}

function parseProjectSearchResponse(body: unknown): JiraProjectSearchResult {
  if (body === null || typeof body !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Jira returned an unexpected payload.",
    );
  }
  const record = body as Record<string, unknown>;
  const values = record.values;
  if (!Array.isArray(values)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Jira returned an unexpected payload.",
    );
  }
  const nextPageToken =
    typeof record.nextPageToken === "string" && record.nextPageToken.length > 0
      ? record.nextPageToken
      : undefined;
  return {
    values,
    ...(typeof record.total === "number" ? { total: record.total } : {}),
    ...(record.isLast === true ? { isLast: true } : {}),
    ...(nextPageToken !== undefined ? { nextPageToken } : {}),
  };
}

export function createJiraRestClient(
  options: CreateJiraRestClientOptions,
): JiraClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiHost = (options.apiHost ?? options.apiBasePath).replace(/\/$/, "");
  const requestTimeoutMs = options.requestTimeoutMs;
  const authorizationHeader = options.authorizationHeader.trim();

  async function requestJsonAttempt<T>(
    url: string,
    init: {
      readonly method: "GET" | "POST" | "PUT";
      readonly body?: unknown;
      readonly signal?: AbortSignal;
    },
    attemptTimeoutMs: number,
  ): Promise<T> {
    assertAllowedApiUrl(url, apiHost);

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort(new Error("Jira request timed out."));
    }, attemptTimeoutMs);

    const onAbort = (): void => {
      controller.abort(init.signal?.reason);
    };
    if (init.signal !== undefined) {
      if (init.signal.aborted) {
        clearTimeout(timeout);
        throw new DOMException("Aborted", "AbortError");
      }
      init.signal.addEventListener("abort", onAbort, { once: true });
    }

    try {
      const response = await fetchImpl(url, {
        method: init.method,
        headers: {
          Authorization: authorizationHeader,
          Accept: "application/json",
          ...(init.body !== undefined
            ? { "Content-Type": "application/json" }
            : {}),
        },
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        signal: controller.signal,
      });

      const text = await readBoundedResponseText(
        response,
        MAX_HTTP_RESPONSE_BYTES,
        controller.signal,
      );

      if (!response.ok) {
        const parsed = parseJiraErrorBody(text);
        const httpError: JiraHttpError = {
          kind: "http",
          status: response.status,
          ...(parsed?.errorMessages !== undefined
            ? { jiraErrorMessages: parsed.errorMessages }
            : {}),
          ...(parsed?.errors !== undefined
            ? { jiraErrors: parsed.errors }
            : {}),
          ...(parseRetryAfterMs(response) !== undefined
            ? { retryAfterMs: parseRetryAfterMs(response) }
            : {}),
        };
        throw httpError;
      }

      if (text.length === 0) {
        return {} as T;
      }
      try {
        return JSON.parse(text) as T;
      } catch {
        throw new ConnectorSdkError(
          "PROVIDER_ERROR",
          "Jira returned invalid JSON.",
        );
      }
    } finally {
      clearTimeout(timeout);
      if (init.signal !== undefined) {
        init.signal.removeEventListener("abort", onAbort);
      }
    }
  }

  async function requestJsonWithReadRetries<T>(
    url: string,
    init: {
      readonly method: "GET" | "POST";
      readonly body?: unknown;
      readonly signal?: AbortSignal;
    },
  ): Promise<T> {
    let attempt = 0;
    for (;;) {
      try {
        return await requestJsonAttempt<T>(url, init, requestTimeoutMs);
      } catch (error) {
        const canRetry =
          attempt < READ_ONLY_MAX_RETRIES &&
          (isRetryableHttpError(error) || isRetryableNetworkError(error));
        if (!canRetry) {
          throw error;
        }
        attempt += 1;
        const retryAfter =
          error !== null &&
          typeof error === "object" &&
          "kind" in error &&
          (error as JiraHttpError).kind === "http"
            ? (error as JiraHttpError).retryAfterMs
            : undefined;
        await sleepMs(retryAfter ?? READ_ONLY_RETRY_DELAY_MS, init.signal);
      }
    }
  }

  async function requestJsonMutation<T>(
    url: string,
    init: {
      readonly method: "POST" | "PUT";
      readonly body?: unknown;
      readonly signal?: AbortSignal;
    },
  ): Promise<T> {
    return requestJsonAttempt<T>(url, init, requestTimeoutMs);
  }

  return {
    async searchProjects(
      params: JiraProjectSearchParams,
    ): Promise<JiraProjectSearchResult> {
      const url = new URL(`${apiHost}/project/search`);
      url.searchParams.set("startAt", String(params.startAt));
      url.searchParams.set("maxResults", String(params.maxResults));
      assertAllowedApiUrl(url.toString(), apiHost);
      const parsed = await requestJsonWithReadRetries<unknown>(url.toString(), {
        method: "GET",
        ...(params.signal !== undefined ? { signal: params.signal } : {}),
      });
      return parseProjectSearchResponse(parsed);
    },

    async getProject(
      projectIdOrKey: string,
      signal?: AbortSignal,
    ): Promise<unknown> {
      const key = parseProjectKey(projectIdOrKey, "project key");
      const url = `${apiHost}/project/${encodeURIComponent(key)}`;
      assertAllowedApiUrl(url, apiHost);
      return requestJsonWithReadRetries(url, {
        method: "GET",
        ...(signal !== undefined ? { signal } : {}),
      });
    },

    async searchIssues(
      params: JiraIssueSearchParams,
    ): Promise<JiraIssueSearchResult> {
      const url = `${apiHost}/search/jql`;
      assertAllowedApiUrl(url, apiHost);
      const body: Record<string, unknown> = {
        jql: params.jql,
        maxResults: params.maxResults,
      };
      const token = validateNextPageToken(params.nextPageToken);
      if (token !== undefined) {
        body.nextPageToken = token;
      }
      if (params.fields !== undefined && params.fields.length > 0) {
        body.fields = params.fields;
      }
      const parsed = await requestJsonWithReadRetries<unknown>(url, {
        method: "POST",
        body,
        ...(params.signal !== undefined ? { signal: params.signal } : {}),
      });
      return parseIssueSearchResponse(parsed);
    },

    async getIssue(issueKey: string, signal?: AbortSignal): Promise<unknown> {
      const key = parseIssueKey(issueKey, "issue key");
      const url = `${apiHost}/issue/${encodeURIComponent(key)}`;
      assertAllowedApiUrl(url, apiHost);
      return requestJsonWithReadRetries(url, {
        method: "GET",
        ...(signal !== undefined ? { signal } : {}),
      });
    },

    async listIssueTransitions(
      issueKey: string,
      signal?: AbortSignal,
    ): Promise<unknown> {
      const key = parseIssueKey(issueKey, "issue key");
      const url = `${apiHost}/issue/${encodeURIComponent(key)}/transitions`;
      assertAllowedApiUrl(url, apiHost);
      return requestJsonWithReadRetries(url, {
        method: "GET",
        ...(signal !== undefined ? { signal } : {}),
      });
    },

    async createIssue(params: JiraIssueCreateParams): Promise<unknown> {
      const url = `${apiHost}/issue`;
      assertAllowedApiUrl(url, apiHost);
      const projectKey = parseProjectKey(params.projectKey, "project key");
      const fields: Record<string, unknown> = {
        project: { key: projectKey },
        issuetype: { id: params.issueTypeId.trim() },
        summary: params.summary.trim(),
        ...(params.descriptionAdf !== undefined
          ? { description: params.descriptionAdf }
          : {}),
        ...(params.additionalFields ?? {}),
      };
      return requestJsonMutation(url, {
        method: "POST",
        body: { fields },
        ...(params.signal !== undefined ? { signal: params.signal } : {}),
      });
    },

    async updateIssue(params: JiraIssueUpdateParams): Promise<unknown> {
      const key = parseIssueKey(params.issueKey, "issue key");
      const url = `${apiHost}/issue/${encodeURIComponent(key)}`;
      assertAllowedApiUrl(url, apiHost);
      const fields: Record<string, unknown> = {
        ...(params.summary !== undefined
          ? { summary: params.summary.trim() }
          : {}),
        ...(params.descriptionAdf !== undefined
          ? { description: params.descriptionAdf }
          : {}),
        ...(params.additionalFields ?? {}),
      };
      return requestJsonMutation(url, {
        method: "PUT",
        body: { fields },
        ...(params.signal !== undefined ? { signal: params.signal } : {}),
      });
    },

    async createIssueComment(
      params: JiraIssueCommentCreateParams,
    ): Promise<unknown> {
      const key = parseIssueKey(params.issueKey, "issue key");
      const url = `${apiHost}/issue/${encodeURIComponent(key)}/comment`;
      assertAllowedApiUrl(url, apiHost);
      return requestJsonMutation(url, {
        method: "POST",
        body: { body: params.bodyAdf },
        ...(params.signal !== undefined ? { signal: params.signal } : {}),
      });
    },

    async transitionIssue(params: JiraIssueTransitionParams): Promise<unknown> {
      const key = parseIssueKey(params.issueKey, "issue key");
      const url = `${apiHost}/issue/${encodeURIComponent(key)}/transitions`;
      assertAllowedApiUrl(url, apiHost);
      const body: Record<string, unknown> = {
        transition: { id: params.transitionId.trim() },
        ...(params.fields !== undefined ? { fields: params.fields } : {}),
      };
      return requestJsonMutation(url, {
        method: "POST",
        body,
        ...(params.signal !== undefined ? { signal: params.signal } : {}),
      });
    },
  };
}
