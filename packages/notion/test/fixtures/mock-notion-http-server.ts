import http from "node:http";
import type { AddressInfo } from "node:net";

export const FAKE_NOTION_ACCESS_TOKEN =
  "ntn_fixture_notion_integration_token_0123456789abcdef";

export const MOCK_PAGE_ID = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
export const MOCK_DATABASE_ID = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
export const MOCK_DATA_SOURCE_ID = "cccccccccccccccccccccccccccccccc";
export const MOCK_BLOCK_ID = MOCK_PAGE_ID;

export type MockNotionMode =
  "success" | "unauthorized" | "forbidden" | "not_found" | "rate_limit";

export interface MockNotionHttpServer {
  readonly apiOrigin: string;
  getLastAuthorization(): string | undefined;
  getRequestCount(): number;
  getLastNotionVersion(): string | undefined;
  setMode(mode: MockNotionMode): void;
  close(): Promise<void>;
}

function jsonResponse(res: http.ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function hyphenate(id: string): string {
  const compact = id.replace(/-/g, "");
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`;
}

export async function startMockNotionHttpServer(
  expectedAccessToken: string = FAKE_NOTION_ACCESS_TOKEN,
  mode: MockNotionMode = "success",
): Promise<MockNotionHttpServer> {
  let currentMode = mode;
  let lastAuthorization: string | undefined;
  let lastNotionVersion: string | undefined;
  let requestCount = 0;

  const server = http.createServer((req, res) => {
    requestCount += 1;
    lastAuthorization = req.headers.authorization;
    lastNotionVersion = req.headers["notion-version"] as string | undefined;

    if (lastAuthorization !== `Bearer ${expectedAccessToken}`) {
      jsonResponse(res, 401, {
        object: "error",
        status: 401,
        code: "unauthorized",
        message: "Invalid token",
      });
      return;
    }

    if (currentMode === "unauthorized") {
      jsonResponse(res, 401, {
        object: "error",
        status: 401,
        code: "unauthorized",
        message: "Invalid token",
      });
      return;
    }
    if (currentMode === "forbidden") {
      jsonResponse(res, 403, {
        object: "error",
        status: 403,
        code: "restricted_resource",
        message: "Forbidden",
      });
      return;
    }
    if (currentMode === "not_found") {
      jsonResponse(res, 404, {
        object: "error",
        status: 404,
        code: "object_not_found",
        message: "Not found",
      });
      return;
    }
    if (currentMode === "rate_limit") {
      res.setHeader("retry-after", "1");
      jsonResponse(res, 429, {
        object: "error",
        status: 429,
        code: "rate_limited",
        message: "Rate limited",
      });
      return;
    }

    const url = new URL(req.url ?? "/", "http://127.0.0.1");

    if (req.method === "POST" && url.pathname === "/v1/search") {
      jsonResponse(res, 200, {
        object: "list",
        results: [
          {
            object: "page",
            id: hyphenate(MOCK_PAGE_ID),
            created_time: "2024-01-01T00:00:00.000Z",
            last_edited_time: "2024-01-02T00:00:00.000Z",
            archived: false,
            properties: {
              title: {
                type: "title",
                title: [{ type: "text", text: { content: "Fixture page" } }],
              },
            },
          },
        ],
        has_more: false,
      });
      return;
    }

    if (
      req.method === "GET" &&
      url.pathname === `/v1/pages/${hyphenate(MOCK_PAGE_ID)}`
    ) {
      jsonResponse(res, 200, {
        object: "page",
        id: hyphenate(MOCK_PAGE_ID),
        created_time: "2024-01-01T00:00:00.000Z",
        last_edited_time: "2024-01-02T00:00:00.000Z",
        archived: false,
        properties: {
          title: {
            type: "title",
            title: [{ type: "text", text: { content: "Fixture page" } }],
          },
        },
      });
      return;
    }

    if (
      req.method === "GET" &&
      url.pathname === `/v1/blocks/${hyphenate(MOCK_BLOCK_ID)}/children`
    ) {
      jsonResponse(res, 200, {
        object: "list",
        results: [
          {
            object: "block",
            id: "dddddddddddddddddddddddddddddddd",
            type: "paragraph",
            paragraph: {
              rich_text: [{ type: "text", text: { content: "Hello block" } }],
            },
            has_children: false,
          },
        ],
        has_more: false,
      });
      return;
    }

    if (
      req.method === "GET" &&
      url.pathname === `/v1/databases/${hyphenate(MOCK_DATABASE_ID)}`
    ) {
      jsonResponse(res, 200, {
        object: "database",
        id: hyphenate(MOCK_DATABASE_ID),
        title: [{ type: "text", text: { content: "Fixture DB" } }],
        data_sources: [{ id: hyphenate(MOCK_DATA_SOURCE_ID), name: "Default" }],
      });
      return;
    }

    if (
      req.method === "GET" &&
      url.pathname === `/v1/data_sources/${hyphenate(MOCK_DATA_SOURCE_ID)}`
    ) {
      jsonResponse(res, 200, {
        object: "data_source",
        id: hyphenate(MOCK_DATA_SOURCE_ID),
        title: [{ type: "text", text: { content: "Fixture DS" } }],
        database_parent: { database_id: hyphenate(MOCK_DATABASE_ID) },
      });
      return;
    }

    if (
      req.method === "POST" &&
      url.pathname ===
        `/v1/data_sources/${hyphenate(MOCK_DATA_SOURCE_ID)}/query`
    ) {
      jsonResponse(res, 200, {
        object: "list",
        results: [
          {
            object: "page",
            id: hyphenate(MOCK_PAGE_ID),
            properties: {
              title: {
                type: "title",
                title: [{ type: "text", text: { content: "Row page" } }],
              },
            },
          },
        ],
        has_more: false,
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/v1/pages") {
      jsonResponse(res, 200, {
        object: "page",
        id: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        properties: {},
      });
      return;
    }

    if (
      req.method === "PATCH" &&
      url.pathname.startsWith("/v1/pages/") &&
      req.method === "PATCH"
    ) {
      jsonResponse(res, 200, {
        object: "page",
        id: url.pathname.split("/").pop(),
        properties: {},
      });
      return;
    }

    if (req.method === "PATCH" && url.pathname.includes("/children")) {
      jsonResponse(res, 200, {
        object: "list",
        results: [],
      });
      return;
    }

    jsonResponse(res, 404, {
      object: "error",
      status: 404,
      code: "object_not_found",
      message: `Unhandled ${req.method} ${url.pathname}`,
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address() as AddressInfo;
  const apiOrigin = `http://127.0.0.1:${address.port}`;

  return {
    apiOrigin,
    getLastAuthorization: () => lastAuthorization,
    getRequestCount: () => requestCount,
    getLastNotionVersion: () => lastNotionVersion,
    setMode: (next) => {
      currentMode = next;
    },
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
