import http from "node:http";
import type { AddressInfo } from "node:net";

export const FAKE_FIRECRAWL_API_KEY = "fc_fixture_api_key_0123456789abcdef";

export const MOCK_CRAWL_ID = "11111111-1111-4111-8111-111111111111";

export interface MockFirecrawlHttpServer {
  readonly apiOrigin: string;
  getLastAuthorization(): string | undefined;
  getRequestCount(): number;
  getLastCrawlStatusUrl(): string | undefined;
  close(): Promise<void>;
}

export interface StartMockFirecrawlHttpServerOptions {
  readonly expectedApiKey?: string;
}

function jsonResponse(res: http.ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function parseUrl(url: string): URL {
  return new URL(url, "http://127.0.0.1");
}

interface CrawlState {
  readonly pages: ReadonlyArray<{
    readonly markdown: string;
    readonly metadata: { readonly sourceURL: string };
  }>;
  visits: number;
}

export async function startMockFirecrawlHttpServer(
  options: StartMockFirecrawlHttpServerOptions = {},
): Promise<MockFirecrawlHttpServer> {
  const expectedKey = options.expectedApiKey ?? FAKE_FIRECRAWL_API_KEY;
  let lastAuthorization: string | undefined;
  let lastCrawlStatusUrl: string | undefined;
  let requestCount = 0;

  const crawlState: CrawlState = {
    pages: [
      {
        markdown: "# Page one",
        metadata: { sourceURL: "https://example.com/one" },
      },
      {
        markdown: "# Page two",
        metadata: { sourceURL: "https://example.com/two" },
      },
      {
        markdown: "# Page three",
        metadata: { sourceURL: "https://example.com/three" },
      },
    ],
    visits: 0,
  };

  const server = http.createServer(async (req, res) => {
    requestCount += 1;
    const auth = req.headers.authorization;
    lastAuthorization = auth;

    if (auth !== `Bearer ${expectedKey}`) {
      jsonResponse(res, 401, { error: "Unauthorized" });
      return;
    }

    const url = parseUrl(req.url ?? "/");
    const path = url.pathname;

    if (req.method === "POST" && path === "/scrape") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.from(chunk));
      }
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
        url?: string;
      };
      jsonResponse(res, 200, {
        success: true,
        data: {
          markdown: `# Fixture scrape for ${body.url ?? "unknown"}`,
          metadata: { sourceURL: body.url },
        },
        creditsUsed: 1,
      });
      return;
    }

    if (req.method === "POST" && path === "/search") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.from(chunk));
      }
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
        query?: string;
      };
      jsonResponse(res, 200, {
        success: true,
        creditsUsed: 2,
        data: {
          web: [
            {
              url: "https://example.com/search-hit",
              title: `Result for ${body.query ?? ""}`,
              description: "Fixture search snippet",
              markdown: "Search body",
            },
          ],
        },
      });
      return;
    }

    if (req.method === "POST" && path === "/map") {
      jsonResponse(res, 200, {
        success: true,
        links: [
          { url: "https://example.com/", title: "Home" },
          { url: "https://example.com/about", title: "About" },
        ],
      });
      return;
    }

    if (req.method === "POST" && path === "/crawl") {
      jsonResponse(res, 200, {
        success: true,
        id: MOCK_CRAWL_ID,
        url: `http://127.0.0.1/crawl/${MOCK_CRAWL_ID}`,
      });
      return;
    }

    if (req.method === "GET" && path === `/crawl/${MOCK_CRAWL_ID}`) {
      lastCrawlStatusUrl = req.url ?? undefined;
      crawlState.visits += 1;
      const skip = Number(url.searchParams.get("skip") ?? "0");
      const slice = crawlState.pages.slice(skip, skip + 1);
      const hasMore = skip + 1 < crawlState.pages.length;
      const status = hasMore ? "scraping" : "completed";
      const origin = `http://${req.headers.host ?? "127.0.0.1"}`;
      jsonResponse(res, 200, {
        status,
        completed: Math.min(skip + slice.length, crawlState.pages.length),
        total: crawlState.pages.length,
        creditsUsed: 5,
        data: slice,
        ...(hasMore
          ? {
              next: `${origin}/crawl/${MOCK_CRAWL_ID}?skip=${skip + 1}`,
            }
          : {}),
      });
      return;
    }

    jsonResponse(res, 404, { error: "Not found" });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address() as AddressInfo;
  const apiOrigin = `http://127.0.0.1:${address.port}`;

  return {
    apiOrigin,
    getLastAuthorization: () => lastAuthorization,
    getRequestCount: () => requestCount,
    getLastCrawlStatusUrl: () => lastCrawlStatusUrl,
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
