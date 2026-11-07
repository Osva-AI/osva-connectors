import http from "node:http";
import type { AddressInfo } from "node:net";

export const FAKE_CONFLUENCE_ACCESS_TOKEN =
  "confluence_fixture_access_token_abc";

export const MOCK_SPACE_ID = "100";
export const MOCK_SPACE_ID_ALT = "200";
export const MOCK_PAGE_ID = "10001";
export const MOCK_CHILD_PAGE_ID = "10002";

export type MockConfluenceMode =
  | "success"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "rate_limit"
  | "conflict";

export interface MockConfluenceHttpServer {
  readonly apiOriginV2: string;
  readonly apiOriginRest: string;
  getLastAuthorization(): string | undefined;
  getRequestCount(): number;
  setMode(mode: MockConfluenceMode): void;
  close(): Promise<void>;
}

function jsonResponse(res: http.ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

async function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (text.length === 0) {
    return {};
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
}

export async function startMockConfluenceHttpServer(
  expectedAuthorization: string = `Bearer ${FAKE_CONFLUENCE_ACCESS_TOKEN}`,
  mode: MockConfluenceMode = "success",
): Promise<MockConfluenceHttpServer> {
  let currentMode = mode;
  let lastAuthorization: string | undefined;
  let requestCount = 0;
  let pageVersion = 3;

  const server = http.createServer(async (req, res) => {
    requestCount += 1;
    lastAuthorization = req.headers.authorization;

    if (lastAuthorization !== expectedAuthorization) {
      jsonResponse(res, 401, { message: "Unauthorized" });
      return;
    }

    if (currentMode === "unauthorized") {
      jsonResponse(res, 401, { message: "Unauthorized" });
      return;
    }
    if (currentMode === "forbidden") {
      jsonResponse(res, 403, { message: "Forbidden" });
      return;
    }
    if (currentMode === "not_found") {
      jsonResponse(res, 404, { message: "Not found" });
      return;
    }
    if (currentMode === "rate_limit") {
      res.setHeader("retry-after", "1");
      jsonResponse(res, 429, { message: "Rate limited" });
      return;
    }

    const url = new URL(req.url ?? "/", "http://127.0.0.1");

    if (req.method === "GET" && url.pathname === "/wiki/api/v2/spaces") {
      jsonResponse(res, 200, {
        results: [
          {
            id: MOCK_SPACE_ID,
            key: "FIX",
            name: "Fixture Space",
            type: "global",
            status: "current",
          },
          {
            id: MOCK_SPACE_ID_ALT,
            key: "ALT",
            name: "Alt Space",
            type: "global",
            status: "current",
          },
        ],
        _links: {},
      });
      return;
    }

    if (
      req.method === "GET" &&
      url.pathname === `/wiki/api/v2/spaces/${MOCK_SPACE_ID}`
    ) {
      jsonResponse(res, 200, {
        id: MOCK_SPACE_ID,
        key: "FIX",
        name: "Fixture Space",
        type: "global",
        status: "current",
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/wiki/api/v2/pages") {
      const spaceId = url.searchParams.get("space-id");
      jsonResponse(res, 200, {
        results: [
          {
            id: MOCK_PAGE_ID,
            spaceId: spaceId ?? MOCK_SPACE_ID,
            title: "Fixture Page",
            status: "current",
            version: { number: pageVersion },
          },
        ],
        _links: {},
      });
      return;
    }

    if (
      req.method === "GET" &&
      url.pathname === `/wiki/api/v2/pages/${MOCK_PAGE_ID}`
    ) {
      jsonResponse(res, 200, {
        id: MOCK_PAGE_ID,
        spaceId: MOCK_SPACE_ID,
        title: "Fixture Page",
        status: "current",
        version: { number: pageVersion },
        body: {
          representation: "storage",
          value: "<p>Fixture storage body</p>",
        },
      });
      return;
    }

    if (
      req.method === "GET" &&
      url.pathname === `/wiki/api/v2/pages/${MOCK_PAGE_ID}/children`
    ) {
      jsonResponse(res, 200, {
        results: [
          {
            id: MOCK_CHILD_PAGE_ID,
            spaceId: MOCK_SPACE_ID,
            parentId: MOCK_PAGE_ID,
            title: "Child Page",
            status: "current",
          },
        ],
        _links: {},
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/wiki/rest/api/search") {
      jsonResponse(res, 200, {
        results: [
          {
            content: {
              id: MOCK_PAGE_ID,
              type: "page",
              title: "Fixture Page",
            },
            space: { id: MOCK_SPACE_ID },
            excerpt: "Fixture excerpt",
            url: "/spaces/FIX/pages/10001",
          },
        ],
        _links: {},
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/wiki/api/v2/pages") {
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      pageVersion += 1;
      jsonResponse(res, 200, {
        id: "10099",
        spaceId: body.spaceId,
        title: body.title,
        status: "current",
        version: { number: 1 },
        body: body.body,
      });
      return;
    }

    if (
      req.method === "PUT" &&
      url.pathname === `/wiki/api/v2/pages/${MOCK_PAGE_ID}`
    ) {
      if (currentMode === "conflict") {
        jsonResponse(res, 409, { message: "Version conflict" });
        return;
      }
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const version = body.version as { number?: number } | undefined;
      pageVersion = version?.number ?? pageVersion + 1;
      jsonResponse(res, 200, {
        id: MOCK_PAGE_ID,
        spaceId: MOCK_SPACE_ID,
        title: body.title ?? "Fixture Page",
        status: "current",
        version: { number: pageVersion },
        ...(body.body !== undefined ? { body: body.body } : {}),
      });
      return;
    }

    jsonResponse(res, 404, {
      message: `No fixture for ${req.method} ${url.pathname}`,
    });
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
    apiOriginV2: `${origin}/wiki/api/v2`,
    apiOriginRest: `${origin}/wiki/rest/api`,
    getLastAuthorization: () => lastAuthorization,
    getRequestCount: () => requestCount,
    setMode: (mode: MockConfluenceMode) => {
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
