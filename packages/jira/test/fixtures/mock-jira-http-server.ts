import http from "node:http";
import type { AddressInfo } from "node:net";

export const FAKE_JIRA_API_TOKEN = "jira_fixture_api_token_0123456789";
export const FAKE_JIRA_ACCESS_TOKEN = "jira_fixture_access_token_abcdefghij";
export const FAKE_JIRA_EMAIL = "agent@example.com";

export const MOCK_PROJECT_KEY = "DEMO";
export const MOCK_ISSUE_KEY = "DEMO-1";
export const MOCK_ISSUE_ID = "10001";

export type MockJiraAuthMode = "basic" | "bearer";
export type MockJiraMode =
  "success" | "unauthorized" | "forbidden" | "not_found" | "rate_limit";

export interface MockJiraHttpServer {
  readonly apiBasePath: string;
  getLastAuthorization(): string | undefined;
  getRequestCount(): number;
  getLastSearchJqlPath(): boolean;
  setMode(mode: MockJiraMode): void;
  close(): Promise<void>;
}

function jsonResponse(res: http.ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function expectedBasicAuth(): string {
  const basic = Buffer.from(
    `${FAKE_JIRA_EMAIL}:${FAKE_JIRA_API_TOKEN}`,
    "utf8",
  ).toString("base64");
  return `Basic ${basic}`;
}

export async function startMockJiraHttpServer(
  authMode: MockJiraAuthMode = "basic",
  mode: MockJiraMode = "success",
): Promise<MockJiraHttpServer> {
  let currentMode = mode;
  let lastAuthorization: string | undefined;
  let requestCount = 0;
  let lastSearchJqlPath = false;

  const expectedAuth =
    authMode === "basic"
      ? expectedBasicAuth()
      : `Bearer ${FAKE_JIRA_ACCESS_TOKEN}`;

  const server = http.createServer((req, res) => {
    requestCount += 1;
    lastAuthorization = req.headers.authorization;
    lastSearchJqlPath = false;

    if (lastAuthorization !== expectedAuth) {
      jsonResponse(res, 401, {
        errorMessages: ["Unauthorized"],
      });
      return;
    }

    if (currentMode === "unauthorized") {
      jsonResponse(res, 401, { errorMessages: ["Unauthorized"] });
      return;
    }
    if (currentMode === "forbidden") {
      jsonResponse(res, 403, { errorMessages: ["Forbidden"] });
      return;
    }
    if (currentMode === "not_found") {
      jsonResponse(res, 404, { errorMessages: ["Not found"] });
      return;
    }
    if (currentMode === "rate_limit") {
      res.setHeader("retry-after", "1");
      jsonResponse(res, 429, { errorMessages: ["Rate limited"] });
      return;
    }

    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const pathname = url.pathname;

    if (req.method === "GET" && pathname === "/rest/api/3/project/search") {
      jsonResponse(res, 200, {
        values: [
          {
            id: "10000",
            key: MOCK_PROJECT_KEY,
            name: "Demo Project",
          },
          {
            id: "10002",
            key: "OTHER",
            name: "Other Project",
          },
        ],
        total: 2,
        isLast: true,
      });
      return;
    }

    if (
      req.method === "GET" &&
      pathname === `/rest/api/3/project/${MOCK_PROJECT_KEY}`
    ) {
      jsonResponse(res, 200, {
        id: "10000",
        key: MOCK_PROJECT_KEY,
        name: "Demo Project",
      });
      return;
    }

    if (req.method === "POST" && pathname === "/rest/api/3/search/jql") {
      lastSearchJqlPath = true;
      jsonResponse(res, 200, {
        issues: [
          {
            id: MOCK_ISSUE_ID,
            key: MOCK_ISSUE_KEY,
            fields: {
              summary: "Fixture issue",
              project: { key: MOCK_PROJECT_KEY },
              issuetype: { name: "Task" },
              status: { name: "To Do" },
              description: {
                type: "doc",
                version: 1,
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Hello Jira" }],
                  },
                ],
              },
            },
          },
        ],
        isLast: true,
      });
      return;
    }

    if (
      req.method === "GET" &&
      pathname === `/rest/api/3/issue/${MOCK_ISSUE_KEY}`
    ) {
      jsonResponse(res, 200, {
        id: MOCK_ISSUE_ID,
        key: MOCK_ISSUE_KEY,
        fields: {
          summary: "Fixture issue",
          project: { key: MOCK_PROJECT_KEY },
          issuetype: { name: "Task" },
          status: { name: "To Do" },
        },
      });
      return;
    }

    if (
      req.method === "GET" &&
      pathname === `/rest/api/3/issue/${MOCK_ISSUE_KEY}/transitions`
    ) {
      jsonResponse(res, 200, {
        transitions: [
          { id: "11", name: "Done" },
          { id: "21", name: "In Progress" },
        ],
      });
      return;
    }

    if (req.method === "POST" && pathname === "/rest/api/3/issue") {
      jsonResponse(res, 201, {
        id: "10003",
        key: "DEMO-2",
      });
      return;
    }

    if (
      req.method === "PUT" &&
      pathname === `/rest/api/3/issue/${MOCK_ISSUE_KEY}`
    ) {
      jsonResponse(res, 204, {});
      return;
    }

    if (
      req.method === "POST" &&
      pathname === `/rest/api/3/issue/${MOCK_ISSUE_KEY}/comment`
    ) {
      jsonResponse(res, 201, { id: "20001" });
      return;
    }

    if (
      req.method === "POST" &&
      pathname === `/rest/api/3/issue/${MOCK_ISSUE_KEY}/transitions`
    ) {
      jsonResponse(res, 204, {});
      return;
    }

    jsonResponse(res, 404, { errorMessages: ["Unknown path"] });
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", (err?: Error) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });

  const address = server.address() as AddressInfo;
  const origin = `http://127.0.0.1:${address.port}`;
  const apiBasePath = `${origin}/rest/api/3`;

  return {
    apiBasePath,
    getLastAuthorization: () => lastAuthorization,
    getRequestCount: () => requestCount,
    getLastSearchJqlPath: () => lastSearchJqlPath,
    setMode: (next) => {
      currentMode = next;
    },
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      }),
  };
}
