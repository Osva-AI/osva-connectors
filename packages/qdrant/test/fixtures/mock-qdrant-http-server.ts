import http from "node:http";
import type { AddressInfo } from "node:net";

export const FAKE_QDRANT_API_KEY =
  "qdrant_fixture_key_0123456789abcdef0123456789abcd";

export type MockQdrantMode =
  "success" | "unauthorized" | "forbidden" | "not_found" | "rate_limit";

export interface MockQdrantHttpServer {
  readonly baseUrl: string;
  getLastApiKey(): string | undefined;
  getRequestCount(): number;
  getLastPathname(): string | undefined;
  getLastMethod(): string | undefined;
  setMode(mode: MockQdrantMode): void;
  close(): Promise<void>;
}

function jsonResponse(res: http.ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export async function startMockQdrantHttpServer(
  expectedApiKey: string = FAKE_QDRANT_API_KEY,
  mode: MockQdrantMode = "success",
): Promise<MockQdrantHttpServer> {
  let currentMode = mode;
  let lastApiKey: string | undefined;
  let lastPathname: string | undefined;
  let lastMethod: string | undefined;
  let requestCount = 0;

  const server = http.createServer((req, res) => {
    requestCount += 1;
    lastMethod = req.method;
    lastApiKey = req.headers["api-key"] as string | undefined;
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    lastPathname = url.pathname;

    if (expectedApiKey.length > 0 && lastApiKey !== expectedApiKey) {
      jsonResponse(res, 401, { status: { error: "Invalid API key" } });
      return;
    }

    if (currentMode === "unauthorized") {
      jsonResponse(res, 401, { status: { error: "Invalid API key" } });
      return;
    }
    if (currentMode === "forbidden") {
      jsonResponse(res, 403, { status: { error: "Forbidden" } });
      return;
    }
    if (currentMode === "not_found") {
      jsonResponse(res, 404, { status: { error: "Not found" } });
      return;
    }
    if (currentMode === "rate_limit") {
      res.setHeader("retry-after", "1");
      jsonResponse(res, 429, { status: { error: "Rate limited" } });
      return;
    }

    if (req.method === "GET" && url.pathname === "/collections") {
      jsonResponse(res, 200, {
        result: {
          collections: [{ name: "docs" }, { name: "restricted" }],
        },
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/collections/docs") {
      jsonResponse(res, 200, {
        result: {
          status: "green",
          config: { params: { vectors: { size: 3, distance: "Cosine" } } },
        },
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/collections/docs/points") {
      jsonResponse(res, 200, {
        result: [{ id: 1, payload: { title: "hello" } }],
      });
      return;
    }

    if (
      req.method === "POST" &&
      url.pathname === "/collections/docs/points/scroll"
    ) {
      jsonResponse(res, 200, {
        result: {
          points: [{ id: 1, payload: { title: "scroll" } }],
          next_page_offset: null,
        },
      });
      return;
    }

    if (
      req.method === "POST" &&
      url.pathname === "/collections/docs/points/query"
    ) {
      jsonResponse(res, 200, {
        result: {
          points: [{ id: 1, score: 0.99, payload: { title: "match" } }],
        },
      });
      return;
    }

    if (
      req.method === "POST" &&
      url.pathname === "/collections/docs/points/count"
    ) {
      jsonResponse(res, 200, { result: { count: 42 } });
      return;
    }

    if (req.method === "PUT" && url.pathname === "/collections/docs/points") {
      const wait = url.searchParams.get("wait") === "true";
      jsonResponse(res, 200, {
        result: {
          operation_id: 1,
          status: wait ? "completed" : "acknowledged",
        },
      });
      return;
    }

    jsonResponse(res, 404, { status: { error: "Unknown route" } });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    baseUrl,
    getLastApiKey: () => lastApiKey,
    getRequestCount: () => requestCount,
    getLastPathname: () => lastPathname,
    getLastMethod: () => lastMethod,
    setMode: (next) => {
      currentMode = next;
    },
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
