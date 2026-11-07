import http from "node:http";
import type { AddressInfo } from "node:net";

export const FAKE_OUTLOOK_ACCESS_TOKEN =
  "eyJ0eXAiOsva_fixture_outlook_access_token_000000";

export const MOCK_MAIL_FOLDER_ID = "AQMkADFixtureInbox";
export const MOCK_MESSAGE_ID = "AQMkAGFixtureMsg001";
export const MOCK_CALENDAR_ID = "AQMkADFixtureCal001";
export const MOCK_EVENT_ID = "AQMkAGFixtureEvt001";

export type MockGraphMode =
  | "success"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "rate_limit"
  | "server_error";

export interface MockGraphHttpServer {
  readonly graphApiOrigin: string;
  getLastAuthorization(): string | undefined;
  getRequestCount(): number;
  getLastRequestBody(): string | undefined;
  setMode(mode: MockGraphMode): void;
  close(): Promise<void>;
}

interface StartOptions {
  readonly expectedToken?: string;
  readonly mode?: MockGraphMode;
}

function jsonResponse(res: http.ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function graphError(status: number, code: string, message: string) {
  return {
    error: {
      code,
      message,
    },
  };
}

export async function startMockGraphHttpServer(
  options: StartOptions = {},
): Promise<MockGraphHttpServer> {
  let mode: MockGraphMode = options.mode ?? "success";
  let lastAuth: string | undefined;
  let requestCount = 0;
  let lastBody: string | undefined;
  const expectedToken = options.expectedToken ?? FAKE_OUTLOOK_ACCESS_TOKEN;

  let serverOrigin = "";

  const server = http.createServer((req, res) => {
    requestCount += 1;
    lastAuth = req.headers.authorization;

    const auth = req.headers.authorization;
    if (auth !== `Bearer ${expectedToken}`) {
      jsonResponse(
        res,
        401,
        graphError(401, "InvalidAuthenticationToken", "Access token invalid"),
      );
      return;
    }

    if (mode === "unauthorized") {
      jsonResponse(
        res,
        401,
        graphError(401, "InvalidAuthenticationToken", "Access token invalid"),
      );
      return;
    }
    if (mode === "forbidden") {
      jsonResponse(res, 403, graphError(403, "AccessDenied", "Forbidden"));
      return;
    }
    if (mode === "not_found") {
      jsonResponse(res, 404, graphError(404, "itemNotFound", "Not found"));
      return;
    }
    if (mode === "rate_limit") {
      res.setHeader("retry-after", "1");
      jsonResponse(
        res,
        429,
        graphError(429, "activityLimitReached", "Throttled"),
      );
      return;
    }
    if (mode === "server_error") {
      jsonResponse(res, 500, graphError(500, "generalException", "Error"));
      return;
    }

    const url = new URL(req.url ?? "/", serverOrigin || "http://127.0.0.1");
    const path = url.pathname;

    const collectBody = (): Promise<string> =>
      new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        req.on("error", reject);
      });

    void (async () => {
      if (req.method === "POST") {
        lastBody = await collectBody();
      }

      if (path === "/v1.0/me/mailFolders" && req.method === "GET") {
        const nextLink = `${serverOrigin}/v1.0/me/mailFolders?$skiptoken=page2`;
        jsonResponse(res, 200, {
          value: [
            {
              id: MOCK_MAIL_FOLDER_ID,
              displayName: "Inbox",
              parentFolderId: "root",
            },
          ],
          "@odata.nextLink": nextLink,
        });
        return;
      }

      if (
        /^\/v1\.0\/me\/mailFolders\/[^/]+\/messages$/.test(path) &&
        req.method === "GET"
      ) {
        jsonResponse(res, 200, {
          value: [
            {
              id: MOCK_MESSAGE_ID,
              subject: "Fixture subject",
              receivedDateTime: "2026-01-01T12:00:00Z",
              from: {
                emailAddress: { address: "sender@fixture.test" },
              },
            },
          ],
        });
        return;
      }

      if (/^\/v1\.0\/me\/messages\/[^/]+$/.test(path) && req.method === "GET") {
        jsonResponse(res, 200, {
          id: MOCK_MESSAGE_ID,
          subject: "Fixture",
          body: { contentType: "text", content: "Hello from fixture" },
          from: { emailAddress: { address: "sender@fixture.test" } },
          toRecipients: [{ emailAddress: { address: "reader@fixture.test" } }],
          receivedDateTime: "2026-01-01T12:00:00Z",
        });
        return;
      }

      if (path === "/v1.0/me/messages" && req.method === "GET") {
        jsonResponse(res, 200, {
          value: [
            {
              id: MOCK_MESSAGE_ID,
              subject: "Search hit",
            },
          ],
        });
        return;
      }

      if (path === "/v1.0/me/calendars" && req.method === "GET") {
        jsonResponse(res, 200, {
          value: [{ id: MOCK_CALENDAR_ID, name: "Calendar" }],
        });
        return;
      }

      if (
        /^\/v1\.0\/me\/calendars\/[^/]+\/events$/.test(path) &&
        req.method === "GET"
      ) {
        jsonResponse(res, 200, {
          value: [
            {
              id: MOCK_EVENT_ID,
              subject: "Meeting",
              start: { dateTime: "2026-01-02T10:00:00Z", timeZone: "UTC" },
              end: { dateTime: "2026-01-02T11:00:00Z", timeZone: "UTC" },
            },
          ],
        });
        return;
      }

      if (/^\/v1\.0\/me\/events\/[^/]+$/.test(path) && req.method === "GET") {
        jsonResponse(res, 200, {
          id: MOCK_EVENT_ID,
          subject: "Meeting",
          start: { dateTime: "2026-01-02T10:00:00Z", timeZone: "UTC" },
          end: { dateTime: "2026-01-02T11:00:00Z", timeZone: "UTC" },
        });
        return;
      }

      if (path === "/v1.0/me/sendMail" && req.method === "POST") {
        res.statusCode = 202;
        res.end();
        return;
      }

      if (
        /^\/v1\.0\/me\/calendars\/[^/]+\/events$/.test(path) &&
        req.method === "POST"
      ) {
        jsonResponse(res, 201, { id: "AQMkNewEvent" });
        return;
      }

      jsonResponse(res, 404, graphError(404, "itemNotFound", "Unknown path"));
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
  serverOrigin = `http://127.0.0.1:${address.port}`;
  const graphApiOrigin = `${serverOrigin}/v1.0`;

  return {
    graphApiOrigin,
    getLastAuthorization: () => lastAuth,
    getRequestCount: () => requestCount,
    getLastRequestBody: () => lastBody,
    setMode(m: MockGraphMode) {
      mode = m;
    },
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
