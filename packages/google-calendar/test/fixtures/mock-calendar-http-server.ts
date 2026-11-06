import http from "node:http";
import type { AddressInfo } from "node:net";

export const FAKE_CAL_ACCESS_TOKEN =
  "ya29.osva_fixture_calendar_access_token_000000";

export type MockCalendarMode =
  | "success"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "rate_limit"
  | "server_error";

export interface MockCalendarHttpServer {
  readonly calendarApiOrigin: string;
  getLastAuthorization(): string | undefined;
  getRequestCount(): number;
  getLastMethod(): string | undefined;
  setMode(mode: MockCalendarMode): void;
  close(): Promise<void>;
}

interface StartOptions {
  readonly expectedToken?: string;
  readonly mode?: MockCalendarMode;
}

function jsonResponse(res: http.ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function googleError(status: number, message: string, googleStatus: string) {
  return {
    error: {
      code: status,
      message,
      status: googleStatus,
    },
  };
}

export async function startMockCalendarHttpServer(
  options: StartOptions = {},
): Promise<MockCalendarHttpServer> {
  let mode: MockCalendarMode = options.mode ?? "success";
  let lastAuth: string | undefined;
  let requestCount = 0;
  let lastMethod: string | undefined;
  const expectedToken = options.expectedToken ?? FAKE_CAL_ACCESS_TOKEN;

  const server = http.createServer((req, res) => {
    requestCount += 1;
    lastAuth = req.headers.authorization;
    lastMethod = req.method;

    const auth = req.headers.authorization;
    if (auth !== `Bearer ${expectedToken}`) {
      jsonResponse(
        res,
        401,
        googleError(401, "Invalid Credentials", "UNAUTHENTICATED"),
      );
      return;
    }

    if (mode === "unauthorized") {
      jsonResponse(
        res,
        401,
        googleError(401, "Invalid Credentials", "UNAUTHENTICATED"),
      );
      return;
    }
    if (mode === "forbidden") {
      jsonResponse(
        res,
        403,
        googleError(403, "Forbidden", "PERMISSION_DENIED"),
      );
      return;
    }
    if (mode === "not_found") {
      jsonResponse(res, 404, googleError(404, "Not Found", "NOT_FOUND"));
      return;
    }
    if (mode === "rate_limit") {
      jsonResponse(
        res,
        429,
        googleError(429, "Rate Limit", "RESOURCE_EXHAUSTED"),
      );
      return;
    }
    if (mode === "server_error") {
      jsonResponse(res, 500, googleError(500, "Internal", "INTERNAL"));
      return;
    }

    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const path = url.pathname;

    const collectBody = (): Promise<string> =>
      new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        req.on("error", reject);
      });

    void (async () => {
      const bodyText =
        req.method === "POST" || req.method === "PUT" || req.method === "PATCH"
          ? await collectBody()
          : "";

      if (
        path === "/calendar/v3/users/me/calendarList" &&
        req.method === "GET"
      ) {
        jsonResponse(res, 200, {
          items: [
            {
              id: "primary",
              summary: "Fixture",
              timeZone: "America/Los_Angeles",
              accessRole: "owner",
              primary: true,
            },
          ],
        });
        return;
      }

      if (
        path.startsWith("/calendar/v3/calendars/") &&
        path.endsWith("/events") &&
        req.method === "GET"
      ) {
        jsonResponse(res, 200, {
          items: [
            {
              id: "evt1",
              summary: "Meeting",
              start: { dateTime: "2025-01-01T10:00:00Z" },
              end: { dateTime: "2025-01-01T11:00:00Z" },
            },
          ],
        });
        return;
      }

      const eventGetMatch = path.match(
        /^\/calendar\/v3\/calendars\/([^/]+)\/events\/([^/]+)$/,
      );
      if (eventGetMatch !== null && req.method === "GET") {
        jsonResponse(res, 200, {
          id: eventGetMatch[2],
          summary: "Fixture event",
          description: "untrusted",
          start: { dateTime: "2025-01-01T10:00:00Z" },
          end: { dateTime: "2025-01-01T11:00:00Z" },
        });
        return;
      }

      if (path === "/calendar/v3/freeBusy" && req.method === "POST") {
        void bodyText;
        jsonResponse(res, 200, {
          calendars: {
            primary: {
              busy: [
                {
                  start: "2025-01-01T10:00:00Z",
                  end: "2025-01-01T11:00:00Z",
                },
              ],
            },
          },
        });
        return;
      }

      const createMatch = path.match(
        /^\/calendar\/v3\/calendars\/([^/]+)\/events$/,
      );
      if (createMatch !== null && req.method === "POST") {
        jsonResponse(res, 200, {
          id: "created_evt",
          summary: "Created",
          start: { dateTime: "2025-01-02T10:00:00Z" },
          end: { dateTime: "2025-01-02T11:00:00Z" },
        });
        return;
      }

      const patchMatch = path.match(
        /^\/calendar\/v3\/calendars\/([^/]+)\/events\/([^/]+)$/,
      );
      if (patchMatch !== null && req.method === "PATCH") {
        jsonResponse(res, 200, {
          id: patchMatch[2],
          summary: "Patched",
        });
        return;
      }

      if (patchMatch !== null && req.method === "DELETE") {
        res.statusCode = 204;
        res.end();
        return;
      }

      jsonResponse(res, 404, googleError(404, "Unknown path", "NOT_FOUND"));
    })().catch(() => {
      res.statusCode = 500;
      res.end();
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => resolve());
    server.on("error", reject);
  });

  const address = server.address() as AddressInfo;
  const origin = `http://127.0.0.1:${address.port}`;

  return {
    calendarApiOrigin: `${origin}/calendar/v3`,
    getLastAuthorization: () => lastAuth,
    getRequestCount: () => requestCount,
    getLastMethod: () => lastMethod,
    setMode(m: MockCalendarMode) {
      mode = m;
    },
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
