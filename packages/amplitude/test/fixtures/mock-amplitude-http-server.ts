import http from "node:http";
import type { AddressInfo } from "node:net";

export const FAKE_AMPLITUDE_API_KEY = "amplitude_fixture_api_key_0123456789ab";
export const FAKE_AMPLITUDE_SECRET_KEY =
  "amplitude_fixture_secret_key_0123456789ab";

export const MOCK_CHART_ID = "chart_fixture_01";

export type MockAmplitudeMode =
  | "success"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "rate_limit"
  | "rate_limit_once"
  | "server_error"
  | "invalid_json"
  | "slow";

export interface MockAmplitudeHttpServer {
  readonly apiOrigin: string;
  getLastAuthorization(): string | undefined;
  getRequestCount(): number;
  getLastRequestPath(): string | undefined;
  getLastQueryEvents(): string[];
  setMode(mode: MockAmplitudeMode): void;
  close(): Promise<void>;
}

export interface StartMockAmplitudeHttpServerOptions {
  readonly expectedApiKey?: string;
  readonly expectedSecretKey?: string;
  readonly mode?: MockAmplitudeMode;
  readonly slowDelayMs?: number;
}

function jsonResponse(res: http.ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function parseUrl(url: string): URL {
  return new URL(url, "http://127.0.0.1");
}

function decodeBasicAuth(
  header: string | undefined,
): { user: string; pass: string } | undefined {
  if (header === undefined || !header.startsWith("Basic ")) {
    return undefined;
  }
  try {
    const decoded = Buffer.from(
      header.slice("Basic ".length),
      "base64",
    ).toString("utf8");
    const colon = decoded.indexOf(":");
    if (colon < 0) {
      return undefined;
    }
    return { user: decoded.slice(0, colon), pass: decoded.slice(colon + 1) };
  } catch {
    return undefined;
  }
}

const SERIES_BODY = {
  data: {
    series: [[100, 120]],
    seriesMeta: ["All Users"],
    xValues: ["2024-06-01", "2024-06-02"],
  },
};

export async function startMockAmplitudeHttpServer(
  options: StartMockAmplitudeHttpServerOptions = {},
): Promise<MockAmplitudeHttpServer> {
  let mode: MockAmplitudeMode = options.mode ?? "success";
  let lastAuthorization: string | undefined;
  let lastRequestPath: string | undefined;
  let lastQueryEvents: string[] = [];
  let requestCount = 0;
  let rateLimitRetried = false;
  const expectedApiKey = options.expectedApiKey ?? FAKE_AMPLITUDE_API_KEY;
  const expectedSecretKey =
    options.expectedSecretKey ?? FAKE_AMPLITUDE_SECRET_KEY;

  const server = http.createServer(async (req, res) => {
    requestCount += 1;
    lastAuthorization = req.headers.authorization;
    lastQueryEvents = [];

    if (mode === "slow") {
      await new Promise((resolve) =>
        setTimeout(resolve, options.slowDelayMs ?? 8_000),
      );
    }

    const auth = decodeBasicAuth(req.headers.authorization);
    if (auth?.user !== expectedApiKey || auth?.pass !== expectedSecretKey) {
      jsonResponse(res, 401, { error: "Invalid API key or secret." });
      return;
    }

    if (mode === "unauthorized") {
      jsonResponse(res, 401, { error: "Unauthorized." });
      return;
    }

    if (mode === "forbidden") {
      jsonResponse(res, 403, { error: "Forbidden." });
      return;
    }

    if (
      mode === "rate_limit" ||
      (mode === "rate_limit_once" && !rateLimitRetried)
    ) {
      if (mode === "rate_limit_once") {
        rateLimitRetried = true;
      }
      res.setHeader("Retry-After", "1");
      jsonResponse(res, 429, { error: "Rate limit exceeded." });
      return;
    }

    if (mode === "server_error") {
      jsonResponse(res, 503, { error: "Unavailable." });
      return;
    }

    if (mode === "invalid_json") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end("{not-json");
      return;
    }

    const parsed = parseUrl(req.url ?? "/");
    const pathname = parsed.pathname.replace(/\/$/, "") || "/";
    lastRequestPath = pathname;

    for (const [key, value] of parsed.searchParams.entries()) {
      if (key === "e" || key === "e2" || key === "se" || key === "re") {
        lastQueryEvents.push(value);
      }
    }

    if (mode === "not_found" && pathname.includes("/chart/")) {
      jsonResponse(res, 404, { error: "Chart not found." });
      return;
    }

    if (pathname === "/api/2/events/list") {
      jsonResponse(res, 200, {
        data: {
          events: ["View Product", "Purchase"],
        },
      });
      return;
    }

    if (pathname === "/api/2/events/segmentation") {
      jsonResponse(res, 200, SERIES_BODY);
      return;
    }

    if (pathname === "/api/2/funnels") {
      jsonResponse(res, 200, {
        data: {
          steps: [
            { event: "View Product", count: 1000 },
            { event: "Purchase", count: 120 },
          ],
        },
      });
      return;
    }

    if (pathname === "/api/2/retention") {
      jsonResponse(res, 200, {
        data: {
          series: [
            {
              dates: ["Jun 01"],
              values: {
                "Jun 01": [{ count: 50, outof: 50, incomplete: false }],
              },
            },
          ],
        },
      });
      return;
    }

    if (pathname === "/api/2/users") {
      jsonResponse(res, 200, SERIES_BODY);
      return;
    }

    if (pathname === "/api/2/sessions/average") {
      jsonResponse(res, 200, SERIES_BODY);
      return;
    }

    if (pathname.startsWith("/api/3/chart/") && pathname.endsWith("/query")) {
      jsonResponse(res, 200, {
        data: {
          series: [[1, 2, 3]],
          seriesMeta: [{ segmentIndex: 0 }],
          xValues: ["2024-06-01", "2024-06-02", "2024-06-03"],
        },
      });
      return;
    }

    if (
      pathname === "/api/2/usersearch" ||
      pathname === "/api/2/useractivity"
    ) {
      jsonResponse(res, 404, { error: "Not supported." });
      return;
    }

    jsonResponse(res, 404, { error: `Unknown path: ${pathname}` });
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
  const apiOrigin = `http://127.0.0.1:${address.port}`;

  return {
    apiOrigin,
    getLastAuthorization: () => lastAuthorization,
    getRequestCount: () => requestCount,
    getLastRequestPath: () => lastRequestPath,
    getLastQueryEvents: () => [...lastQueryEvents],
    setMode: (next) => {
      mode = next;
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
