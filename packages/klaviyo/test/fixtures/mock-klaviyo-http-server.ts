import http from "node:http";
import type { AddressInfo } from "node:net";

export const FAKE_KLAVIYO_PRIVATE_API_KEY =
  "pk_fixture_klaviyo_private_api_key_0123456789abcdef";

export const MOCK_CAMPAIGN_ID = "camp01";
export const MOCK_FLOW_ID = "flow01";
export const MOCK_METRIC_ID = "RESQ6t";
export const MOCK_CONVERSION_METRIC_ID = "RESQ6t";

export type MockKlaviyoMode =
  | "success"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "rate_limit"
  | "rate_limit_once"
  | "server_error"
  | "invalid_json"
  | "malicious_paging"
  | "event_pii"
  | "slow";

export interface MockKlaviyoHttpServer {
  readonly apiOrigin: string;
  getLastAuthorization(): string | undefined;
  getLastRevision(): string | undefined;
  getRequestCount(): number;
  getLastEventsUrl(): string | undefined;
  getLastCampaignReportBody(): unknown;
  setMode(mode: MockKlaviyoMode): void;
  close(): Promise<void>;
}

export interface StartMockKlaviyoHttpServerOptions {
  readonly expectedApiKey?: string;
  readonly mode?: MockKlaviyoMode;
  readonly slowDelayMs?: number;
}

function jsonResponse(res: http.ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/vnd.api+json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function klaviyoError(status: number, title: string, code: string) {
  return {
    errors: [
      {
        status,
        code,
        title,
        detail: title,
      },
    ],
  };
}

function parseUrl(url: string): URL {
  return new URL(url, "http://127.0.0.1");
}

export async function startMockKlaviyoHttpServer(
  options: StartMockKlaviyoHttpServerOptions = {},
): Promise<MockKlaviyoHttpServer> {
  let mode: MockKlaviyoMode = options.mode ?? "success";
  let lastAuthorization: string | undefined;
  let lastRevision: string | undefined;
  let lastEventsUrl: string | undefined;
  let lastCampaignReportBody: unknown;
  let requestCount = 0;
  let rateLimitRetried = false;
  const expectedKey = options.expectedApiKey ?? FAKE_KLAVIYO_PRIVATE_API_KEY;

  const server = http.createServer(async (req, res) => {
    requestCount += 1;
    const auth = req.headers.authorization;
    lastAuthorization = auth;
    const revisionHeader = req.headers.revision;
    lastRevision = Array.isArray(revisionHeader)
      ? revisionHeader[0]
      : revisionHeader;

    if (mode === "slow") {
      await new Promise((resolve) =>
        setTimeout(resolve, options.slowDelayMs ?? 8_000),
      );
    }

    const expectedAuth = `Klaviyo-API-Key ${expectedKey}`;
    if (auth !== expectedAuth) {
      jsonResponse(
        res,
        401,
        klaviyoError(401, "Authentication failed.", "authentication_failed"),
      );
      return;
    }

    if (mode === "unauthorized") {
      jsonResponse(
        res,
        401,
        klaviyoError(401, "Authentication failed.", "authentication_failed"),
      );
      return;
    }

    if (mode === "forbidden") {
      jsonResponse(
        res,
        403,
        klaviyoError(403, "Permission denied.", "permission_denied"),
      );
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
      jsonResponse(res, 429, klaviyoError(429, "Throttled.", "throttled"));
      return;
    }

    if (mode === "server_error") {
      jsonResponse(
        res,
        503,
        klaviyoError(503, "Unavailable.", "service_unavailable"),
      );
      return;
    }

    if (mode === "invalid_json") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/vnd.api+json");
      res.end("{not-json");
      return;
    }

    const parsed = parseUrl(req.url ?? "/");
    const pathname = parsed.pathname.replace(/\/$/, "") || "/";

    if (req.method === "GET" && pathname === "/api/accounts") {
      jsonResponse(res, 200, {
        data: [
          {
            type: "account",
            id: "acc01",
            attributes: {
              contact_information: { organization_name: "Fixture Org" },
              timezone: "US/Eastern",
            },
          },
        ],
      });
      return;
    }

    if (req.method === "GET" && pathname === "/api/campaigns") {
      if (mode === "malicious_paging") {
        jsonResponse(res, 200, {
          data: [
            {
              type: "campaign",
              id: MOCK_CAMPAIGN_ID,
              attributes: { name: "Fixture Campaign" },
            },
          ],
          links: {
            next: "https://evil.example/api/campaigns?page%5Bcursor%5D=bad",
          },
        });
        return;
      }
      jsonResponse(res, 200, {
        data: [
          {
            type: "campaign",
            id: MOCK_CAMPAIGN_ID,
            attributes: { name: "Fixture Campaign", status: "sent" },
          },
        ],
        links: {
          self: `${parsed.origin}/api/campaigns`,
        },
      });
      return;
    }

    if (
      req.method === "GET" &&
      pathname === `/api/campaigns/${MOCK_CAMPAIGN_ID}`
    ) {
      if (mode === "not_found") {
        jsonResponse(res, 404, klaviyoError(404, "Not found.", "not_found"));
        return;
      }
      jsonResponse(res, 200, {
        data: {
          type: "campaign",
          id: MOCK_CAMPAIGN_ID,
          attributes: { name: "Fixture Campaign", status: "sent" },
        },
      });
      return;
    }

    if (req.method === "GET" && pathname === "/api/flows") {
      jsonResponse(res, 200, {
        data: [
          {
            type: "flow",
            id: MOCK_FLOW_ID,
            attributes: { name: "Fixture Flow", status: "live" },
          },
        ],
      });
      return;
    }

    if (req.method === "GET" && pathname === `/api/flows/${MOCK_FLOW_ID}`) {
      jsonResponse(res, 200, {
        data: {
          type: "flow",
          id: MOCK_FLOW_ID,
          attributes: { name: "Fixture Flow", status: "live" },
        },
      });
      return;
    }

    if (req.method === "GET" && pathname === "/api/metrics") {
      jsonResponse(res, 200, {
        data: [
          {
            type: "metric",
            id: MOCK_METRIC_ID,
            attributes: { name: "Placed Order" },
          },
        ],
      });
      return;
    }

    if (req.method === "GET" && pathname === `/api/metrics/${MOCK_METRIC_ID}`) {
      jsonResponse(res, 200, {
        data: {
          type: "metric",
          id: MOCK_METRIC_ID,
          attributes: { name: "Placed Order" },
        },
      });
      return;
    }

    if (req.method === "GET" && pathname === "/api/events") {
      lastEventsUrl = req.url ?? undefined;
      if (parsed.searchParams.get("include") !== null) {
        jsonResponse(
          res,
          400,
          klaviyoError(400, "Invalid include.", "invalid"),
        );
        return;
      }
      if (mode === "event_pii") {
        jsonResponse(res, 200, {
          data: [
            {
              type: "event",
              id: "evt01",
              attributes: {
                datetime: "2024-06-01T12:00:00+00:00",
                timestamp: 1_716_724_800,
                uuid: "11111111-2222-3333-4444-555555555555",
                event_properties: {
                  email: "pii@example.com",
                  $phone_number: "+15551234567",
                },
                profile_id: "prof_secret",
              },
              relationships: {
                profile: {
                  data: { type: "profile", id: "prof_secret" },
                },
              },
            },
          ],
          included: [
            {
              type: "profile",
              id: "prof_secret",
              attributes: { email: "pii@example.com", phone_number: "+1" },
            },
          ],
        });
        return;
      }
      jsonResponse(res, 200, {
        data: [
          {
            type: "event",
            id: "evt01",
            attributes: {
              datetime: "2024-06-01T12:00:00+00:00",
              metric_id: MOCK_METRIC_ID,
            },
          },
        ],
      });
      return;
    }

    if (
      req.method === "POST" &&
      (pathname === "/api/campaign-values-reports" ||
        pathname === "/api/flow-values-reports")
    ) {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk as Buffer);
      }
      const rawBody = Buffer.concat(chunks).toString("utf8");
      let parsedBody: unknown = {};
      try {
        parsedBody = rawBody.length > 0 ? JSON.parse(rawBody) : {};
      } catch {
        parsedBody = {};
      }
      if (pathname === "/api/campaign-values-reports") {
        lastCampaignReportBody = parsedBody;
      }
      const reportKind =
        pathname === "/api/campaign-values-reports" ? "campaign" : "flow";
      jsonResponse(res, 200, {
        data: {
          type:
            reportKind === "campaign"
              ? "campaign-values-report"
              : "flow-values-report",
          attributes: {
            results: [
              {
                groupings: {
                  [`${reportKind}_id`]:
                    reportKind === "campaign" ? MOCK_CAMPAIGN_ID : MOCK_FLOW_ID,
                  send_channel: "email",
                },
                statistics: {
                  opens: 100,
                  open_rate: 0.25,
                },
              },
            ],
          },
        },
        links: {
          self: `${parsed.origin}${pathname}`,
        },
      });
      return;
    }

    jsonResponse(res, 404, klaviyoError(404, "Not found.", "not_found"));
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
  const apiOrigin = `http://127.0.0.1:${address.port}/api`;

  return {
    apiOrigin,
    getLastAuthorization: () => lastAuthorization,
    getLastRevision: () => lastRevision,
    getRequestCount: () => requestCount,
    getLastEventsUrl: () => lastEventsUrl,
    getLastCampaignReportBody: () => lastCampaignReportBody,
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
