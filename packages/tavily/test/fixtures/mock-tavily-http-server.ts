import http from "node:http";
import type { AddressInfo } from "node:net";

export const FAKE_TAVILY_API_KEY = "tvly_fixture_api_key_0123456789abcdef";

export type MockTavilyMode =
  "success" | "unauthorized" | "rate_limit" | "plan_limit";

export interface MockTavilyHttpServer {
  readonly apiOrigin: string;
  getLastAuthorization(): string | undefined;
  getRequestCount(): number;
  getLastPathname(): string | undefined;
  getLastBody(): Record<string, unknown> | undefined;
  setMode(mode: MockTavilyMode): void;
  close(): Promise<void>;
}

function jsonResponse(res: http.ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export async function startMockTavilyHttpServer(
  expectedApiKey: string = FAKE_TAVILY_API_KEY,
  mode: MockTavilyMode = "success",
): Promise<MockTavilyHttpServer> {
  let currentMode = mode;
  let lastAuthorization: string | undefined;
  let lastPathname: string | undefined;
  let lastBody: Record<string, unknown> | undefined;
  let requestCount = 0;

  const server = http.createServer(async (req, res) => {
    requestCount += 1;
    lastAuthorization = req.headers.authorization;
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    lastPathname = url.pathname;

    if (lastAuthorization !== `Bearer ${expectedApiKey}`) {
      jsonResponse(res, 401, {
        detail: { error: "Unauthorized: missing or invalid API key." },
      });
      return;
    }

    if (currentMode === "unauthorized") {
      jsonResponse(res, 401, {
        detail: { error: "Unauthorized: missing or invalid API key." },
      });
      return;
    }
    if (currentMode === "rate_limit") {
      res.setHeader("retry-after", "1");
      jsonResponse(res, 429, {
        detail: { error: "Rate limit exceeded." },
      });
      return;
    }
    if (currentMode === "plan_limit") {
      jsonResponse(res, 432, {
        detail: { error: "Plan limit exceeded." },
      });
      return;
    }

    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk as Buffer);
    }
    const raw = Buffer.concat(chunks).toString("utf8");
    try {
      lastBody =
        raw.length > 0 ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      lastBody = {};
    }

    if (req.method === "POST" && url.pathname === "/search") {
      jsonResponse(res, 200, {
        query: lastBody.query,
        results: [
          {
            title: "Fixture result",
            url: "https://example.com/article",
            content: "Fixture snippet content.",
            score: 0.91,
          },
        ],
        images: [],
        answer: "",
        response_time: 0.42,
        usage: { credits: 1 },
        request_id: "fixture-search-req",
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/extract") {
      jsonResponse(res, 200, {
        results: [
          {
            url: "https://example.com/article",
            raw_content: "Extracted fixture content.",
          },
        ],
        failed_results: [],
        response_time: 0.31,
        usage: { credits: 1 },
        request_id: "fixture-extract-req",
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/crawl") {
      jsonResponse(res, 200, {
        base_url: lastBody.url,
        results: [
          {
            url: "https://example.com/",
            raw_content: "Crawled fixture content.",
          },
        ],
        response_time: 1.2,
        usage: { credits: 2 },
        request_id: "fixture-crawl-req",
      });
      return;
    }

    jsonResponse(res, 404, {
      detail: { error: "Not found" },
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => resolve());
    server.on("error", reject);
  });

  const address = server.address() as AddressInfo;

  return {
    get apiOrigin() {
      return `http://127.0.0.1:${address.port}`;
    },
    getLastAuthorization: () => lastAuthorization,
    getRequestCount: () => requestCount,
    getLastPathname: () => lastPathname,
    getLastBody: () => lastBody,
    setMode: (next) => {
      currentMode = next;
    },
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
