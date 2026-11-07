import http from "node:http";
import type { AddressInfo } from "node:net";

export const FAKE_LINEAR_API_KEY =
  "lin_api_fixture_linear_connector_test_00000001";

export const FAKE_LINEAR_OAUTH_TOKEN = "lin_oauth_fixture_access_token_0001";

export const MOCK_TEAM_ID = "11111111-1111-4111-8111-111111111111";
export const MOCK_ISSUE_ID = "22222222-2222-4222-8222-222222222222";
export const MOCK_PROJECT_ID = "33333333-3333-4333-8333-333333333333";

export type MockLinearMode =
  | "success"
  | "unauthorized"
  | "forbidden"
  | "graphql_unauthorized"
  | "graphql_forbidden"
  | "rate_limit"
  | "partial_error"
  | "graphql_errors_with_data"
  | "mutation_success_false";

export interface MockLinearGraphqlServer {
  readonly graphqlOrigin: string;
  readonly graphqlUrl: string;
  readonly fixtureTeamId: string;
  getLastAuthorization(): string | undefined;
  getRequestCount(): number;
  setMode(mode: MockLinearMode): void;
  close(): Promise<void>;
}

function jsonResponse(res: http.ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

const MOCK_VIEWER = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Fixture User",
  displayName: "Fixture User",
  email: "fixture@example.com",
  active: true,
} as const;

const MOCK_TEAM = {
  id: MOCK_TEAM_ID,
  key: "FIX",
  name: "Fixture Team",
} as const;

const MOCK_ISSUE = {
  id: MOCK_ISSUE_ID,
  identifier: "FIX-1",
  title: "Fixture issue",
  description: "Fixture description",
  priority: 2,
  url: "https://linear.app/fixture/issue/FIX-1",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-02T00:00:00.000Z",
  team: MOCK_TEAM,
  project: { id: MOCK_PROJECT_ID, name: "Fixture Project" },
  state: {
    id: "44444444-4444-4444-8444-444444444444",
    name: "Todo",
    type: "unstarted",
  },
} as const;

const MOCK_PROJECT = {
  id: MOCK_PROJECT_ID,
  name: "Fixture Project",
  description: "Fixture project description",
  state: "started",
  team: MOCK_TEAM,
} as const;

function graphqlSuccessBody(query: string): unknown {
  if (query.includes("OsvaLinearViewerGet")) {
    return { data: { viewer: MOCK_VIEWER } };
  }
  if (query.includes("OsvaLinearTeamList")) {
    return {
      data: {
        teams: {
          nodes: [MOCK_TEAM],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    };
  }
  if (query.includes("OsvaLinearIssueList")) {
    return {
      data: {
        issues: {
          nodes: [MOCK_ISSUE],
          pageInfo: { hasNextPage: true, endCursor: "cursor-issues-1" },
        },
      },
    };
  }
  if (query.includes("OsvaLinearIssueGet")) {
    return { data: { issue: MOCK_ISSUE } };
  }
  if (query.includes("OsvaLinearIssueSearch")) {
    return {
      data: {
        issueSearch: {
          nodes: [MOCK_ISSUE],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    };
  }
  if (query.includes("OsvaLinearProjectList")) {
    return {
      data: {
        projects: {
          nodes: [MOCK_PROJECT],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    };
  }
  if (query.includes("OsvaLinearProjectGet")) {
    return { data: { project: MOCK_PROJECT } };
  }
  if (query.includes("OsvaLinearIssueCreate")) {
    return { data: { issueCreate: { success: true, issue: MOCK_ISSUE } } };
  }
  if (query.includes("OsvaLinearIssueUpdate")) {
    return { data: { issueUpdate: { success: true, issue: MOCK_ISSUE } } };
  }
  if (query.includes("OsvaLinearCommentCreate")) {
    return {
      data: {
        commentCreate: {
          success: true,
          comment: {
            id: "55555555-5555-4555-8555-555555555555",
            body: "Fixture comment",
            createdAt: "2024-01-03T00:00:00.000Z",
            issue: { id: MOCK_ISSUE_ID },
          },
        },
      },
    };
  }
  return {
    errors: [
      { message: "Unknown fixture query", extensions: { code: "INVALID" } },
    ],
  };
}

export interface StartMockLinearGraphqlServerOptions {
  readonly expectedApiKey?: string;
  readonly expectedOAuthToken?: string;
  readonly mode?: MockLinearMode;
}

export async function startMockLinearGraphqlServer(
  options: StartMockLinearGraphqlServerOptions = {},
): Promise<MockLinearGraphqlServer> {
  const expectedApiKey = options.expectedApiKey ?? FAKE_LINEAR_API_KEY;
  const expectedOAuthToken =
    options.expectedOAuthToken ?? FAKE_LINEAR_OAUTH_TOKEN;
  let currentMode = options.mode ?? "success";
  let lastAuthorization: string | undefined;
  let requestCount = 0;

  const server = http.createServer(async (req, res) => {
    requestCount += 1;
    lastAuthorization = req.headers.authorization;

    const authorized =
      lastAuthorization === expectedApiKey ||
      lastAuthorization === `Bearer ${expectedOAuthToken}`;

    if (!authorized) {
      jsonResponse(res, 401, { error: "Unauthorized" });
      return;
    }

    if (currentMode === "unauthorized") {
      jsonResponse(res, 401, { error: "Unauthorized" });
      return;
    }
    if (currentMode === "forbidden") {
      jsonResponse(res, 403, { error: "Forbidden" });
      return;
    }
    if (currentMode === "rate_limit") {
      res.setHeader("retry-after", "1");
      jsonResponse(res, 429, { error: "Rate limited" });
      return;
    }

    if (req.method !== "POST" || req.url !== "/graphql") {
      jsonResponse(res, 404, { error: "Not found" });
      return;
    }

    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk as Buffer);
    }
    const raw = Buffer.concat(chunks).toString("utf8");
    let query = "";
    try {
      const parsed = JSON.parse(raw) as { query?: string };
      query = parsed.query ?? "";
    } catch {
      jsonResponse(res, 400, { error: "Invalid JSON" });
      return;
    }

    if (currentMode === "graphql_unauthorized") {
      jsonResponse(res, 200, {
        errors: [
          {
            message: "Authentication required",
            extensions: { code: "AUTHENTICATION_ERROR" },
          },
        ],
      });
      return;
    }
    if (currentMode === "graphql_forbidden") {
      jsonResponse(res, 200, {
        errors: [
          {
            message: "Forbidden",
            extensions: { code: "FORBIDDEN" },
          },
        ],
      });
      return;
    }
    if (currentMode === "partial_error") {
      jsonResponse(res, 200, {
        data: null,
        errors: [{ message: "Something failed" }],
      });
      return;
    }
    if (currentMode === "graphql_errors_with_data") {
      jsonResponse(res, 200, {
        data: { viewer: MOCK_VIEWER },
        errors: [{ message: "Partial failure" }],
      });
      return;
    }
    if (
      currentMode === "mutation_success_false" &&
      query.includes("OsvaLinearIssueCreate")
    ) {
      jsonResponse(res, 200, {
        data: { issueCreate: { success: false, issue: null } },
      });
      return;
    }

    jsonResponse(res, 200, graphqlSuccessBody(query));
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", (error?: Error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  const address = server.address() as AddressInfo;
  const origin = `http://127.0.0.1:${address.port}`;

  return {
    graphqlOrigin: origin,
    graphqlUrl: `${origin}/graphql`,
    fixtureTeamId: MOCK_TEAM_ID,
    getLastAuthorization: () => lastAuthorization,
    getRequestCount: () => requestCount,
    setMode: (mode) => {
      currentMode = mode;
    },
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
  };
}
