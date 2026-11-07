import http from "node:http";
import type { AddressInfo } from "node:net";

export const FAKE_EXA_API_KEY =
  "exa_fixture_api_key_0123456789abcdef0123456789abcd";

export type MockExaMode =
  "success" | "unauthorized" | "forbidden" | "not_found" | "rate_limit";

export interface MockExaHttpServer {
  readonly apiOrigin: string;
  getLastApiKey(): string | undefined;
  getRequestCount(): number;
  getLastPathname(): string | undefined;
  setMode(mode: MockExaMode): void;
  close(): Promise<void>;
}

function jsonResponse(res: http.ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export async function startMockExaHttpServer(
  expectedApiKey: string = FAKE_EXA_API_KEY,
  mode: MockExaMode = "success",
): Promise<MockExaHttpServer> {
  let currentMode = mode;
  let lastApiKey: string | undefined;
  let lastPathname: string | undefined;
  let requestCount = 0;

  const server = http.createServer((req, res) => {
    requestCount += 1;
    lastApiKey = req.headers["x-api-key"] as string | undefined;
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    lastPathname = url.pathname;

    if (lastApiKey !== expectedApiKey) {
      jsonResponse(res, 401, {
        requestId: "req_unauth",
        error: "Invalid API key",
        tag: "UNAUTHORIZED",
      });
      return;
    }

    if (currentMode === "unauthorized") {
      jsonResponse(res, 401, {
        requestId: "req_unauth",
        error: "Invalid API key",
        tag: "UNAUTHORIZED",
      });
      return;
    }
    if (currentMode === "forbidden") {
      jsonResponse(res, 403, {
        requestId: "req_forbidden",
        error: "Forbidden",
        tag: "FORBIDDEN",
      });
      return;
    }
    if (currentMode === "not_found") {
      jsonResponse(res, 404, {
        requestId: "req_not_found",
        error: "Not found",
        tag: "NOT_FOUND",
      });
      return;
    }
    if (currentMode === "rate_limit") {
      res.setHeader("retry-after", "1");
      jsonResponse(res, 429, {
        requestId: "req_rate",
        error: "Rate limited",
        tag: "RATE_LIMITED",
      });
      return;
    }

    if (req.method !== "POST") {
      jsonResponse(res, 405, {
        requestId: "req_method",
        error: "Method not allowed",
        tag: "INVALID_REQUEST",
      });
      return;
    }

    if (url.pathname === "/search") {
      jsonResponse(res, 200, {
        requestId: "req_search",
        results: [
          {
            id: "doc-fixture-1",
            title: "Fixture result",
            url: "https://example.com/article",
            publishedDate: "2024-01-01T00:00:00.000Z",
            author: "Fixture Author",
            text: "Untrusted fixture page body",
            highlights: ["fixture highlight"],
          },
        ],
      });
      return;
    }

    if (url.pathname === "/contents") {
      jsonResponse(res, 200, {
        requestId: "req_contents",
        results: [
          {
            title: "Fixture page",
            url: "https://example.com/page",
            text: "Fixture contents text",
          },
        ],
        statuses: [{ id: "https://example.com/page", status: "success" }],
      });
      return;
    }

    if (url.pathname === "/answer") {
      jsonResponse(res, 200, {
        requestId: "req_answer",
        answer: "Fixture answer from provider",
        citations: [
          {
            title: "Citation",
            url: "https://example.com/source",
          },
        ],
      });
      return;
    }

    jsonResponse(res, 404, {
      requestId: "req_unknown",
      error: "Unknown path",
      tag: "NOT_FOUND",
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address() as AddressInfo;
  const apiOrigin = `http://127.0.0.1:${address.port}`;

  return {
    apiOrigin,
    getLastApiKey: () => lastApiKey,
    getRequestCount: () => requestCount,
    getLastPathname: () => lastPathname,
    setMode: (mode: MockExaMode) => {
      currentMode = mode;
    },
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}
