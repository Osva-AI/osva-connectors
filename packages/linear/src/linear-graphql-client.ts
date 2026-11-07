import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  LINEAR_API_HOST,
  LINEAR_GRAPHQL_PATH,
  MAX_HTTP_RESPONSE_BYTES,
  READ_ONLY_MAX_RETRIES,
  READ_ONLY_RETRY_DELAY_MS,
} from "./constants.js";
import { formatLinearIdForApi, validatePaginationCursor } from "./linear-id.js";
import type {
  LinearClient,
  LinearCommentCreateParams,
  LinearIssueCreateParams,
  LinearIssueGetParams,
  LinearIssueListParams,
  LinearIssueSearchParams,
  LinearIssueUpdateParams,
  LinearListResult,
  LinearProjectGetParams,
  LinearProjectListParams,
  LinearTeamListParams,
  LinearViewerGetParams,
} from "./linear-client.js";

export interface LinearHttpError {
  readonly kind: "http";
  readonly status: number;
  readonly message?: string;
  readonly retryAfterMs?: number;
}

export interface LinearGraphqlError {
  readonly kind: "graphql";
  readonly messages: readonly string[];
  readonly extensionCodes: readonly (string | undefined)[];
  readonly rateLimited?: boolean;
}

interface GraphqlEnvelope<TData> {
  readonly data?: TData;
  readonly errors?: ReadonlyArray<{
    readonly message?: string;
    readonly extensions?: { readonly code?: string };
  }>;
}

const VIEWER_GET_QUERY = `#graphql
query OsvaLinearViewerGet {
  viewer {
    id
    name
    displayName
    email
    active
  }
}`;

const TEAM_LIST_QUERY = `#graphql
query OsvaLinearTeamList($first: Int!, $after: String) {
  teams(first: $first, after: $after) {
    nodes {
      id
      key
      name
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}`;

const ISSUE_LIST_QUERY = `#graphql
query OsvaLinearIssueList($first: Int!, $after: String, $filter: IssueFilter) {
  issues(first: $first, after: $after, filter: $filter) {
    nodes {
      id
      identifier
      title
      description
      priority
      url
      createdAt
      updatedAt
      team { id key name }
      project { id name }
      state { id name type }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}`;

const ISSUE_GET_QUERY = `#graphql
query OsvaLinearIssueGet($id: String!) {
  issue(id: $id) {
    id
    identifier
    title
    description
    priority
    url
    createdAt
    updatedAt
    team { id key name }
    project { id name }
    state { id name type }
  }
}`;

const ISSUE_SEARCH_QUERY = `#graphql
query OsvaLinearIssueSearch($query: String!, $first: Int!, $after: String) {
  issueSearch(query: $query, first: $first, after: $after) {
    nodes {
      id
      identifier
      title
      description
      priority
      url
      createdAt
      updatedAt
      team { id key name }
      project { id name }
      state { id name type }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}`;

const PROJECT_LIST_QUERY = `#graphql
query OsvaLinearProjectList($first: Int!, $after: String, $filter: ProjectFilter) {
  projects(first: $first, after: $after, filter: $filter) {
    nodes {
      id
      name
      description
      state
      team { id key name }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}`;

const PROJECT_GET_QUERY = `#graphql
query OsvaLinearProjectGet($id: String!) {
  project(id: $id) {
    id
    name
    description
    state
    team { id key name }
  }
}`;

const ISSUE_CREATE_MUTATION = `#graphql
mutation OsvaLinearIssueCreate($input: IssueCreateInput!) {
  issueCreate(input: $input) {
    success
    issue {
      id
      identifier
      title
      description
      priority
      url
      createdAt
      updatedAt
      team { id key name }
      project { id name }
      state { id name type }
    }
  }
}`;

const ISSUE_UPDATE_MUTATION = `#graphql
mutation OsvaLinearIssueUpdate($id: String!, $input: IssueUpdateInput!) {
  issueUpdate(id: $id, input: $input) {
    success
    issue {
      id
      identifier
      title
      description
      priority
      url
      createdAt
      updatedAt
      team { id key name }
      project { id name }
      state { id name type }
    }
  }
}`;

const COMMENT_CREATE_MUTATION = `#graphql
mutation OsvaLinearCommentCreate($input: CommentCreateInput!) {
  commentCreate(input: $input) {
    success
    comment {
      id
      body
      createdAt
      issue { id }
    }
  }
}`;

const PRODUCTION_HOSTNAME = "api.linear.app";

export interface CreateLinearGraphqlClientOptions {
  readonly authorizationHeader: string;
  readonly requestTimeoutMs: number;
  readonly apiHost?: string;
  readonly fetchImpl?: typeof fetch;
}

function assertAllowedGraphqlUrl(url: string, apiHost: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Linear request URL is invalid.",
    );
  }

  const hostBase = apiHost.replace(/\/$/, "");
  const onApi =
    url === hostBase ||
    url === `${hostBase}${LINEAR_GRAPHQL_PATH}` ||
    url.startsWith(`${hostBase}/`);
  if (!onApi) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Linear request URL is not allowed.",
    );
  }

  if (
    apiHost === LINEAR_API_HOST ||
    apiHost === `${LINEAR_API_HOST}${LINEAR_GRAPHQL_PATH}`
  ) {
    if (parsed.protocol !== "https:") {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Linear request URL is not allowed.",
      );
    }
    if (parsed.hostname !== PRODUCTION_HOSTNAME) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Linear request URL is not allowed.",
      );
    }
    if (
      parsed.pathname !== LINEAR_GRAPHQL_PATH &&
      parsed.pathname !== "/graphql"
    ) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Linear request URL is not allowed.",
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
      "Linear request URL is not allowed.",
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
        "Linear response exceeds the connector size limit.",
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
        "Linear response exceeds the connector size limit.",
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

function extractGraphqlErrors(envelope: GraphqlEnvelope<unknown>): {
  readonly messages: string[];
  readonly extensionCodes: (string | undefined)[];
} {
  if (envelope.errors === undefined) {
    return { messages: [], extensionCodes: [] };
  }
  const messages: string[] = [];
  const extensionCodes: (string | undefined)[] = [];
  for (const entry of envelope.errors) {
    if (typeof entry.message === "string") {
      messages.push(entry.message);
    }
    extensionCodes.push(entry.extensions?.code);
  }
  return { messages, extensionCodes };
}

function envelopeIndicatesRateLimit(
  messages: readonly string[],
  extensionCodes: readonly (string | undefined)[],
): boolean {
  const combined =
    `${messages.join(" ")} ${extensionCodes.join(" ")}`.toLowerCase();
  return (
    combined.includes("rate") ||
    combined.includes("throttl") ||
    extensionCodes.some(
      (code) => typeof code === "string" && code.toUpperCase().includes("RATE"),
    )
  );
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

function isRetryableTransportError(error: unknown): boolean {
  if (
    error !== null &&
    typeof error === "object" &&
    "kind" in error &&
    (error as LinearHttpError).kind === "http"
  ) {
    const status = (error as LinearHttpError).status;
    return status === 429 || status >= 500;
  }
  if (
    error !== null &&
    typeof error === "object" &&
    "kind" in error &&
    (error as LinearGraphqlError).kind === "graphql"
  ) {
    return (error as LinearGraphqlError).rateLimited === true;
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

function parseConnection(
  value: unknown,
  label: string,
): LinearListResult<unknown> {
  if (value === null || typeof value !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      `Linear returned an unexpected ${label}.`,
    );
  }
  const record = value as Record<string, unknown>;
  const nodes = Array.isArray(record.nodes) ? record.nodes : [];
  const pageInfo =
    record.pageInfo !== null && typeof record.pageInfo === "object"
      ? (record.pageInfo as Record<string, unknown>)
      : {};
  return {
    nodes,
    pageInfo: {
      hasNextPage: pageInfo.hasNextPage === true,
      endCursor:
        typeof pageInfo.endCursor === "string" ? pageInfo.endCursor : null,
    },
  };
}

export function createLinearGraphqlClient(
  options: CreateLinearGraphqlClientOptions,
): LinearClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiHostRaw = (
    options.apiHost ?? `${LINEAR_API_HOST}${LINEAR_GRAPHQL_PATH}`
  ).replace(/\/$/, "");
  const graphqlUrl = apiHostRaw.endsWith(LINEAR_GRAPHQL_PATH)
    ? apiHostRaw
    : `${apiHostRaw}${LINEAR_GRAPHQL_PATH}`;
  const requestTimeoutMs = options.requestTimeoutMs;
  const authorizationHeader = options.authorizationHeader.trim();

  async function executeAttempt<TData>(
    query: string,
    variables: Record<string, unknown> | undefined,
    attemptTimeoutMs: number,
    signal?: AbortSignal,
  ): Promise<TData> {
    assertAllowedGraphqlUrl(graphqlUrl, apiHostRaw);

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort(new Error("Linear request timed out."));
    }, attemptTimeoutMs);

    const onAbort = (): void => {
      controller.abort(signal?.reason);
    };
    if (signal !== undefined) {
      if (signal.aborted) {
        clearTimeout(timeout);
        throw new DOMException("Aborted", "AbortError");
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }

    try {
      const response = await fetchImpl(graphqlUrl, {
        method: "POST",
        headers: {
          Authorization: authorizationHeader,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          ...(variables !== undefined ? { variables } : {}),
        }),
        signal: controller.signal,
      });

      const text = await readBoundedResponseText(
        response,
        MAX_HTTP_RESPONSE_BYTES,
        controller.signal,
      );

      if (!response.ok) {
        let message: string | undefined;
        try {
          const parsed = JSON.parse(text) as { message?: string };
          message = parsed.message;
        } catch {
          // ignore
        }
        const httpError: LinearHttpError = {
          kind: "http",
          status: response.status,
          ...(message !== undefined ? { message } : {}),
          ...(parseRetryAfterMs(response) !== undefined
            ? { retryAfterMs: parseRetryAfterMs(response) }
            : {}),
        };
        throw httpError;
      }

      let envelope: GraphqlEnvelope<TData>;
      try {
        envelope = JSON.parse(text) as GraphqlEnvelope<TData>;
      } catch {
        throw new ConnectorSdkError(
          "PROVIDER_ERROR",
          "Linear returned invalid JSON.",
        );
      }

      const { messages, extensionCodes } = extractGraphqlErrors(envelope);
      const rateLimited = envelopeIndicatesRateLimit(messages, extensionCodes);

      if (messages.length > 0 && envelope.data === undefined) {
        const gqlError: LinearGraphqlError = {
          kind: "graphql",
          messages,
          extensionCodes,
          ...(rateLimited ? { rateLimited: true } : {}),
        };
        throw gqlError;
      }

      if (envelope.data === undefined) {
        throw new ConnectorSdkError(
          "PROVIDER_ERROR",
          "Linear returned an empty GraphQL payload.",
        );
      }

      if (messages.length > 0) {
        const gqlError: LinearGraphqlError = {
          kind: "graphql",
          messages,
          extensionCodes,
          ...(rateLimited ? { rateLimited: true } : {}),
        };
        throw gqlError;
      }

      return envelope.data;
    } finally {
      clearTimeout(timeout);
      if (signal !== undefined) {
        signal.removeEventListener("abort", onAbort);
      }
    }
  }

  async function executeRead<TData>(
    query: string,
    variables: Record<string, unknown> | undefined,
    signal?: AbortSignal,
  ): Promise<TData> {
    let attempt = 0;
    for (;;) {
      try {
        return await executeAttempt<TData>(
          query,
          variables,
          requestTimeoutMs,
          signal,
        );
      } catch (error) {
        const canRetry =
          attempt < READ_ONLY_MAX_RETRIES &&
          (isRetryableTransportError(error) || isRetryableNetworkError(error));
        if (!canRetry) {
          throw error;
        }
        attempt += 1;
        const retryAfter =
          error !== null &&
          typeof error === "object" &&
          "kind" in error &&
          (error as LinearHttpError).kind === "http"
            ? (error as LinearHttpError).retryAfterMs
            : undefined;
        await sleepMs(retryAfter ?? READ_ONLY_RETRY_DELAY_MS, signal);
      }
    }
  }

  async function executeMutation<TData>(
    query: string,
    variables: Record<string, unknown> | undefined,
    signal?: AbortSignal,
  ): Promise<TData> {
    return executeAttempt<TData>(query, variables, requestTimeoutMs, signal);
  }

  function buildIssueFilter(params: {
    readonly teamId?: string;
    readonly projectId?: string;
  }): Record<string, unknown> | undefined {
    const filter: Record<string, unknown> = {};
    if (params.teamId !== undefined) {
      filter.team = { id: { eq: formatLinearIdForApi(params.teamId) } };
    }
    if (params.projectId !== undefined) {
      filter.project = { id: { eq: formatLinearIdForApi(params.projectId) } };
    }
    return Object.keys(filter).length > 0 ? filter : undefined;
  }

  function buildProjectFilter(
    teamId?: string,
  ): Record<string, unknown> | undefined {
    if (teamId === undefined) {
      return undefined;
    }
    return {
      accessibleTeams: { some: { id: { eq: formatLinearIdForApi(teamId) } } },
    };
  }

  return {
    async getViewer(params: LinearViewerGetParams): Promise<unknown> {
      const data = await executeRead<{ viewer?: unknown }>(
        VIEWER_GET_QUERY,
        undefined,
        params.signal,
      );
      return data.viewer;
    },

    async listTeams(
      params: LinearTeamListParams,
    ): Promise<LinearListResult<unknown>> {
      const after = validatePaginationCursor(params.after);
      const data = await executeRead<{ teams?: unknown }>(
        TEAM_LIST_QUERY,
        {
          first: params.first,
          ...(after !== undefined ? { after } : {}),
        },
        params.signal,
      );
      return parseConnection(data.teams, "teams connection");
    },

    async listIssues(
      params: LinearIssueListParams,
    ): Promise<LinearListResult<unknown>> {
      const after = validatePaginationCursor(params.after);
      const filter = buildIssueFilter({
        ...(params.teamId !== undefined ? { teamId: params.teamId } : {}),
        ...(params.projectId !== undefined
          ? { projectId: params.projectId }
          : {}),
      });
      const data = await executeRead<{ issues?: unknown }>(
        ISSUE_LIST_QUERY,
        {
          first: params.first,
          ...(after !== undefined ? { after } : {}),
          ...(filter !== undefined ? { filter } : {}),
        },
        params.signal,
      );
      return parseConnection(data.issues, "issues connection");
    },

    async getIssue(params: LinearIssueGetParams): Promise<unknown> {
      const data = await executeRead<{ issue?: unknown }>(
        ISSUE_GET_QUERY,
        { id: formatLinearIdForApi(params.issueId) },
        params.signal,
      );
      if (data.issue === undefined || data.issue === null) {
        throw new ConnectorSdkError("NOT_FOUND", "Linear issue was not found.");
      }
      return data.issue;
    },

    async searchIssues(
      params: LinearIssueSearchParams,
    ): Promise<LinearListResult<unknown>> {
      const after = validatePaginationCursor(params.after);
      const data = await executeRead<{ issueSearch?: unknown }>(
        ISSUE_SEARCH_QUERY,
        {
          query: params.query,
          first: params.first,
          ...(after !== undefined ? { after } : {}),
        },
        params.signal,
      );
      return parseConnection(data.issueSearch, "issue search connection");
    },

    async listProjects(
      params: LinearProjectListParams,
    ): Promise<LinearListResult<unknown>> {
      const after = validatePaginationCursor(params.after);
      const filter = buildProjectFilter(params.teamId);
      const data = await executeRead<{ projects?: unknown }>(
        PROJECT_LIST_QUERY,
        {
          first: params.first,
          ...(after !== undefined ? { after } : {}),
          ...(filter !== undefined ? { filter } : {}),
        },
        params.signal,
      );
      return parseConnection(data.projects, "projects connection");
    },

    async getProject(params: LinearProjectGetParams): Promise<unknown> {
      const data = await executeRead<{ project?: unknown }>(
        PROJECT_GET_QUERY,
        { id: formatLinearIdForApi(params.projectId) },
        params.signal,
      );
      if (data.project === undefined || data.project === null) {
        throw new ConnectorSdkError(
          "NOT_FOUND",
          "Linear project was not found.",
        );
      }
      return data.project;
    },

    async createIssue(params: LinearIssueCreateParams): Promise<unknown> {
      const input: Record<string, unknown> = {
        teamId: formatLinearIdForApi(params.teamId),
        title: params.title,
      };
      if (params.description !== undefined) {
        input.description = params.description;
      }
      if (params.projectId !== undefined) {
        input.projectId = formatLinearIdForApi(params.projectId);
      }
      const data = await executeMutation<{
        issueCreate?: { issue?: unknown; success?: boolean };
      }>(ISSUE_CREATE_MUTATION, { input }, params.signal);
      const payload = data.issueCreate;
      if (payload?.success === false) {
        throw new ConnectorSdkError(
          "PROVIDER_ERROR",
          "Linear issue create reported failure.",
        );
      }
      if (payload?.issue === undefined || payload.issue === null) {
        throw new ConnectorSdkError(
          "PROVIDER_ERROR",
          "Linear did not return the created issue.",
        );
      }
      return payload.issue;
    },

    async updateIssue(params: LinearIssueUpdateParams): Promise<unknown> {
      const input: Record<string, unknown> = {};
      if (params.title !== undefined) {
        input.title = params.title;
      }
      if (params.description !== undefined) {
        input.description = params.description;
      }
      if (params.stateId !== undefined) {
        input.stateId = formatLinearIdForApi(params.stateId);
      }
      const data = await executeMutation<{
        issueUpdate?: { issue?: unknown; success?: boolean };
      }>(
        ISSUE_UPDATE_MUTATION,
        {
          id: formatLinearIdForApi(params.issueId),
          input,
        },
        params.signal,
      );
      const payload = data.issueUpdate;
      if (payload?.success === false) {
        throw new ConnectorSdkError(
          "PROVIDER_ERROR",
          "Linear issue update reported failure.",
        );
      }
      if (payload?.issue === undefined || payload.issue === null) {
        throw new ConnectorSdkError(
          "PROVIDER_ERROR",
          "Linear did not return the updated issue.",
        );
      }
      return payload.issue;
    },

    async createComment(params: LinearCommentCreateParams): Promise<unknown> {
      const data = await executeMutation<{
        commentCreate?: { comment?: unknown; success?: boolean };
      }>(
        COMMENT_CREATE_MUTATION,
        {
          input: {
            issueId: formatLinearIdForApi(params.issueId),
            body: params.body,
          },
        },
        params.signal,
      );
      const payload = data.commentCreate;
      if (payload?.success === false) {
        throw new ConnectorSdkError(
          "PROVIDER_ERROR",
          "Linear comment create reported failure.",
        );
      }
      const comment = payload?.comment;
      if (comment === undefined || comment === null) {
        throw new ConnectorSdkError(
          "PROVIDER_ERROR",
          "Linear did not return the created comment.",
        );
      }
      const record =
        comment !== null && typeof comment === "object"
          ? (comment as Record<string, unknown>)
          : {};
      const issue =
        record.issue !== null && typeof record.issue === "object"
          ? (record.issue as Record<string, unknown>)
          : undefined;
      return {
        ...record,
        issueId:
          issue !== undefined && typeof issue.id === "string"
            ? issue.id
            : formatLinearIdForApi(params.issueId),
      };
    },
  };
}
