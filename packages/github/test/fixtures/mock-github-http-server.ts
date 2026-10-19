/** Standalone loopback GitHub mock for connector tests (mirrored in osva tool-gateway for cross-repo CI). */
import http from "node:http";
import type { AddressInfo } from "node:net";

export const FAKE_GITHUB_PAT = "ghp_osva_test_fixture_00000000000000000000";

export const MOCK_REPOSITORY_JSON = {
  name: "osva",
  full_name: "Osva-AI/osva",
  description: "OSVA core repository (mock fixture)",
  html_url: "https://github.com/Osva-AI/osva",
  visibility: "public",
  private: false,
  default_branch: "main",
  archived: false,
  fork: false,
} as const;

export type MockGithubMode =
  | "success"
  | "unauthorized"
  | "server_error"
  | "slow"
  | "validation_error"
  | "rate_limit";

export const MOCK_CREATED_ISSUE_JSON = {
  number: 101,
  title: "Fixture issue",
  state: "open",
  html_url: "https://github.com/Osva-AI/osva/issues/101",
  created_at: "2024-06-01T12:00:00Z",
  updated_at: "2024-06-01T12:00:00Z",
  closed_at: null,
  user: { login: "fixture-bot" },
  labels: [],
  comments: 0,
} as const;

export const MOCK_ISSUE_JSON = {
  number: 42,
  title: "Fixture issue for comments",
  state: "open",
  html_url: "https://github.com/Osva-AI/osva/issues/42",
  created_at: "2024-06-01T10:00:00Z",
  updated_at: "2024-06-01T10:00:00Z",
  closed_at: null,
  user: { login: "fixture-bot" },
  labels: [],
  comments: 1,
} as const;

export const MOCK_PULL_REQUEST_AS_ISSUE_JSON = {
  ...MOCK_ISSUE_JSON,
  number: 99,
  title: "Fixture pull request",
  html_url: "https://github.com/Osva-AI/osva/pull/99",
  pull_request: {
    url: "https://api.github.com/repos/Osva-AI/osva/pulls/99",
  },
} as const;

export const MOCK_CREATED_ISSUE_COMMENT_JSON = {
  id: 9001,
  body: "Fixture comment",
  html_url: "https://github.com/Osva-AI/osva/issues/42#issuecomment-9001",
  created_at: "2024-06-01T12:30:00Z",
  user: { login: "fixture-bot" },
} as const;

export interface MockGithubHttpServer {
  readonly apiBaseUrl: string;
  readonly origin: string;
  getLastAuthorization(): string | undefined;
  getRepositoryRequestCount(): number;
  getIssueCreateRequestCount(): number;
  getIssueGetRequestCount(): number;
  getIssueCommentCreateRequestCount(): number;
  getLastIssueCreateBody(): unknown;
  getLastIssueCommentCreateBody(): unknown;
  setMode(mode: MockGithubMode): void;
  close(): Promise<void>;
}

export interface StartMockGithubHttpServerOptions {
  readonly expectedToken?: string;
  readonly mode?: MockGithubMode;
  readonly slowDelayMs?: number;
}

type ParsedGithubPath =
  | {
      readonly kind: "repository";
      readonly owner: string;
      readonly repo: string;
    }
  | { readonly kind: "issues"; readonly owner: string; readonly repo: string }
  | {
      readonly kind: "issue_get";
      readonly owner: string;
      readonly repo: string;
      readonly issueNumber: number;
    }
  | {
      readonly kind: "issue_comment_create";
      readonly owner: string;
      readonly repo: string;
      readonly issueNumber: number;
    };

function parseGithubPath(pathname: string): ParsedGithubPath | null {
  const commentMatch = pathname.match(
    /\/repos\/([^/]+)\/([^/]+)\/issues\/(\d+)\/comments\/?$/,
  );
  if (commentMatch !== null) {
    return {
      kind: "issue_comment_create",
      owner: commentMatch[1]!,
      repo: commentMatch[2]!,
      issueNumber: Number(commentMatch[3]),
    };
  }
  const issueGetMatch = pathname.match(
    /\/repos\/([^/]+)\/([^/]+)\/issues\/(\d+)\/?$/,
  );
  if (issueGetMatch !== null) {
    return {
      kind: "issue_get",
      owner: issueGetMatch[1]!,
      repo: issueGetMatch[2]!,
      issueNumber: Number(issueGetMatch[3]),
    };
  }
  const repoMatch = pathname.match(/\/repos\/([^/]+)\/([^/]+)\/?$/);
  if (repoMatch !== null) {
    return {
      owner: repoMatch[1]!,
      repo: repoMatch[2]!,
      kind: "repository",
    };
  }
  const issuesMatch = pathname.match(/\/repos\/([^/]+)\/([^/]+)\/issues\/?$/);
  if (issuesMatch !== null) {
    return {
      owner: issuesMatch[1]!,
      repo: issuesMatch[2]!,
      kind: "issues",
    };
  }
  return null;
}

function readAuthorization(
  header: string | string[] | undefined,
): string | undefined {
  if (header === undefined) {
    return undefined;
  }
  return Array.isArray(header) ? header[0] : header;
}

function tokenMatches(
  authorization: string | undefined,
  expected: string,
): boolean {
  if (authorization === undefined) {
    return false;
  }
  const lower = authorization.toLowerCase();
  return (
    lower === `token ${expected.toLowerCase()}` ||
    lower === `bearer ${expected.toLowerCase()}`
  );
}

export function startMockGithubHttpServer(
  options: StartMockGithubHttpServerOptions = {},
): Promise<MockGithubHttpServer> {
  const expectedToken = options.expectedToken ?? FAKE_GITHUB_PAT;
  let mode: MockGithubMode = options.mode ?? "success";
  const slowDelayMs = options.slowDelayMs ?? 30_000;
  let lastAuthorization: string | undefined;
  let repositoryRequestCount = 0;
  let issueCreateRequestCount = 0;
  let issueGetRequestCount = 0;
  let issueCommentCreateRequestCount = 0;
  let lastIssueCreateBody: unknown;
  let lastIssueCommentCreateBody: unknown;

  const server = http.createServer((req, res) => {
    const parsed = parseGithubPath(
      new URL(req.url ?? "/", "http://127.0.0.1").pathname,
    );
    if (parsed === null) {
      res.statusCode = 404;
      res.end();
      return;
    }

    if (parsed.kind === "repository" && req.method !== "GET") {
      res.statusCode = 405;
      res.end();
      return;
    }
    if (parsed.kind === "issues" && req.method !== "POST") {
      res.statusCode = 405;
      res.end();
      return;
    }
    if (parsed.kind === "issue_get" && req.method !== "GET") {
      res.statusCode = 405;
      res.end();
      return;
    }
    if (parsed.kind === "issue_comment_create" && req.method !== "POST") {
      res.statusCode = 405;
      res.end();
      return;
    }

    if (parsed.kind === "repository") {
      repositoryRequestCount += 1;
    } else if (parsed.kind === "issues") {
      issueCreateRequestCount += 1;
    } else if (parsed.kind === "issue_get") {
      issueGetRequestCount += 1;
    } else {
      issueCommentCreateRequestCount += 1;
    }
    lastAuthorization = readAuthorization(req.headers.authorization);

    const finish = (
      status: number,
      body: string,
      extraHeaders?: Record<string, string>,
    ) => {
      res.statusCode = status;
      res.setHeader("content-type", "application/json");
      if (extraHeaders !== undefined) {
        for (const [key, value] of Object.entries(extraHeaders)) {
          res.setHeader(key, value);
        }
      }
      res.end(body);
    };

    if (
      mode === "unauthorized" ||
      !tokenMatches(lastAuthorization, expectedToken)
    ) {
      finish(401, JSON.stringify({ message: "Bad credentials" }));
      return;
    }

    const handleMutationPostBody = (
      onBody: (body: unknown) => void,
      respond: () => void,
    ) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });
      req.on("end", () => {
        try {
          onBody(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        } catch {
          onBody(undefined);
        }
        respond();
      });
    };

    const respondToMutationFailure = (): boolean => {
      if (mode === "validation_error") {
        finish(422, JSON.stringify({ message: "Validation Failed" }));
        return true;
      }
      if (mode === "server_error") {
        finish(
          500,
          JSON.stringify({
            message: "Internal Server Error",
            debug: "secret_key=DO_NOT_LEAK_IN_TOOL_OUTPUT",
          }),
        );
        return true;
      }
      if (mode === "rate_limit") {
        finish(403, JSON.stringify({ message: "API rate limit exceeded" }), {
          "x-ratelimit-remaining": "0",
          "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 120),
        });
        return true;
      }
      return false;
    };

    if (parsed.kind === "issues") {
      handleMutationPostBody(
        (body) => {
          lastIssueCreateBody = body;
        },
        () => {
          if (respondToMutationFailure()) {
            return;
          }
          finish(200, JSON.stringify(MOCK_CREATED_ISSUE_JSON));
        },
      );
      return;
    }

    if (parsed.kind === "issue_get") {
      if (parsed.issueNumber === 404) {
        finish(404, JSON.stringify({ message: "Not Found" }));
        return;
      }
      if (parsed.issueNumber === 99) {
        finish(200, JSON.stringify(MOCK_PULL_REQUEST_AS_ISSUE_JSON));
        return;
      }
      finish(200, JSON.stringify(MOCK_ISSUE_JSON));
      return;
    }

    if (parsed.kind === "issue_comment_create") {
      handleMutationPostBody(
        (body) => {
          lastIssueCommentCreateBody = body;
        },
        () => {
          if (respondToMutationFailure()) {
            return;
          }
          finish(200, JSON.stringify(MOCK_CREATED_ISSUE_COMMENT_JSON));
        },
      );
      return;
    }

    if (mode === "server_error") {
      finish(
        500,
        JSON.stringify({
          message: "Internal Server Error",
          debug: "secret_key=DO_NOT_LEAK_IN_TOOL_OUTPUT",
        }),
      );
      return;
    }

    if (mode === "slow") {
      setTimeout(() => {
        finish(200, JSON.stringify(MOCK_REPOSITORY_JSON));
      }, slowDelayMs);
      return;
    }

    finish(200, JSON.stringify(MOCK_REPOSITORY_JSON));
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("Mock GitHub server failed to bind."));
        return;
      }
      const port = (address as AddressInfo).port;
      const origin = `http://127.0.0.1:${String(port)}`;
      const apiBaseUrl = `${origin}/api/v3`;

      resolve({
        apiBaseUrl,
        origin,
        getLastAuthorization: () => lastAuthorization,
        getRepositoryRequestCount: () => repositoryRequestCount,
        getIssueCreateRequestCount: () => issueCreateRequestCount,
        getIssueGetRequestCount: () => issueGetRequestCount,
        getIssueCommentCreateRequestCount: () => issueCommentCreateRequestCount,
        getLastIssueCreateBody: () => lastIssueCreateBody,
        getLastIssueCommentCreateBody: () => lastIssueCommentCreateBody,
        setMode(next: MockGithubMode) {
          mode = next;
        },
        close: () =>
          new Promise((closeResolve, closeReject) => {
            server.close((error) => {
              if (error !== undefined) {
                closeReject(error);
                return;
              }
              closeResolve();
            });
          }),
      });
    });
  });
}
