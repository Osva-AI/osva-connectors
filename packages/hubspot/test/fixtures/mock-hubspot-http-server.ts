import http from "node:http";
import type { AddressInfo } from "node:net";

export const FAKE_HUBSPOT_ACCESS_TOKEN =
  "pat-na1-fixture_hubspot_access_token_0123456789abcdef";

export const MOCK_CONTACT_ID = "101";
export const MOCK_COMPANY_ID = "201";
export const MOCK_DEAL_ID = "301";
export const HUBSPOT_API_VERSION = "2026-09";

export type MockHubspotMode =
  | "success"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "rate_limit"
  | "rate_limit_once"
  | "server_error"
  | "invalid_json"
  | "malicious_paging"
  | "contact_pii"
  | "slow";

export interface MockHubspotHttpServer {
  readonly apiOrigin: string;
  getLastAuthorization(): string | undefined;
  getRequestCount(): number;
  getLastContactListUrl(): string | undefined;
  getLastSearchBody(): unknown;
  setMode(mode: MockHubspotMode): void;
  close(): Promise<void>;
}

export interface StartMockHubspotHttpServerOptions {
  readonly expectedAccessToken?: string;
  readonly mode?: MockHubspotMode;
  readonly slowDelayMs?: number;
}

function jsonResponse(res: http.ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function hubspotError(status: number, message: string, category: string) {
  return {
    status: "error",
    message,
    category,
  };
}

function parseUrl(url: string): URL {
  return new URL(url, "http://127.0.0.1");
}

function sampleContact(includeExtraPii: boolean) {
  return {
    id: MOCK_CONTACT_ID,
    properties: {
      hs_object_id: MOCK_CONTACT_ID,
      createdate: "2024-01-01T00:00:00.000Z",
      lastmodifieddate: "2024-06-01T00:00:00.000Z",
      lifecyclestage: "lead",
      hubspot_owner_id: "55",
      ...(includeExtraPii
        ? {
            email: "secret@example.com",
            firstname: "Secret",
            lastname: "Person",
          }
        : {}),
    },
    archived: false,
  };
}

function sampleCompany() {
  return {
    id: MOCK_COMPANY_ID,
    properties: {
      hs_object_id: MOCK_COMPANY_ID,
      createdate: "2024-01-01T00:00:00.000Z",
      lastmodifieddate: "2024-06-01T00:00:00.000Z",
      name: "Fixture Co",
      domain: "fixture.example",
      industry: "Software",
      type: "PROSPECT",
      hubspot_owner_id: "55",
    },
    archived: false,
  };
}

function sampleDeal() {
  return {
    id: MOCK_DEAL_ID,
    properties: {
      hs_object_id: MOCK_DEAL_ID,
      createdate: "2024-01-01T00:00:00.000Z",
      lastmodifieddate: "2024-06-01T00:00:00.000Z",
      dealname: "Fixture Deal",
      dealstage: "appointmentscheduled",
      pipeline: "default",
      amount: "1000",
      closedate: "2024-12-31",
      hubspot_owner_id: "55",
    },
    archived: false,
  };
}

export async function startMockHubspotHttpServer(
  options: StartMockHubspotHttpServerOptions = {},
): Promise<MockHubspotHttpServer> {
  let mode: MockHubspotMode = options.mode ?? "success";
  let lastAuthorization: string | undefined;
  let lastContactListUrl: string | undefined;
  let lastSearchBody: unknown;
  let requestCount = 0;
  let rateLimitRetried = false;
  const expectedToken =
    options.expectedAccessToken ?? FAKE_HUBSPOT_ACCESS_TOKEN;

  const server = http.createServer(async (req, res) => {
    requestCount += 1;
    const auth = req.headers.authorization;
    lastAuthorization = auth;

    if (mode === "slow") {
      await new Promise((resolve) =>
        setTimeout(resolve, options.slowDelayMs ?? 8_000),
      );
    }

    const expectedAuth = `Bearer ${expectedToken}`;
    if (auth !== expectedAuth) {
      jsonResponse(
        res,
        401,
        hubspotError(
          401,
          "Authentication credentials not found.",
          "INVALID_AUTHENTICATION",
        ),
      );
      return;
    }

    if (mode === "unauthorized") {
      jsonResponse(
        res,
        401,
        hubspotError(
          401,
          "Authentication credentials not found.",
          "INVALID_AUTHENTICATION",
        ),
      );
      return;
    }

    if (mode === "forbidden") {
      jsonResponse(
        res,
        403,
        hubspotError(403, "Access denied.", "MISSING_SCOPES"),
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
      jsonResponse(
        res,
        429,
        hubspotError(429, "Rate limit exceeded.", "RATE_LIMIT"),
      );
      return;
    }

    if (mode === "server_error") {
      jsonResponse(
        res,
        503,
        hubspotError(503, "Service unavailable.", "SERVICE_UNAVAILABLE"),
      );
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
    const method = req.method ?? "GET";

    const crmListMatch = pathname.match(
      new RegExp(
        `^/crm/objects/${HUBSPOT_API_VERSION}/(contacts|companies|deals)$`,
      ),
    );
    const crmGetMatch = pathname.match(
      new RegExp(
        `^/crm/objects/${HUBSPOT_API_VERSION}/(contacts|companies|deals)/([0-9]+)$`,
      ),
    );
    const searchMatch = pathname.match(
      new RegExp(
        `^/crm/objects/${HUBSPOT_API_VERSION}/(contacts|companies|deals)/search$`,
      ),
    );
    const associationMatch = pathname.match(
      new RegExp(
        `^/crm/objects/${HUBSPOT_API_VERSION}/(contacts|companies|deals)/([0-9]+)/associations/(contacts|companies|deals)$`,
      ),
    );

    if (method === "GET" && crmListMatch !== null) {
      const type = crmListMatch[1];
      if (type === "contacts") {
        lastContactListUrl = req.url ?? undefined;
      }
      const includePiiInPayload = mode === "contact_pii" && type === "contacts";
      const result =
        type === "contacts"
          ? sampleContact(includePiiInPayload)
          : type === "companies"
            ? sampleCompany()
            : sampleDeal();
      const paging =
        mode === "malicious_paging"
          ? {
              next: {
                after: "evil-cursor",
                link: "https://evil.example/steal",
              },
            }
          : parsed.searchParams.get("after") === undefined
            ? { next: { after: "page-2-cursor" } }
            : undefined;
      jsonResponse(res, 200, {
        results: [result],
        ...(paging !== undefined ? { paging } : {}),
      });
      return;
    }

    if (method === "GET" && crmGetMatch !== null) {
      const type = crmGetMatch[1];
      const id = crmGetMatch[2];
      if (mode === "not_found") {
        jsonResponse(
          res,
          404,
          hubspotError(404, "Resource not found.", "OBJECT_NOT_FOUND"),
        );
        return;
      }
      const result =
        type === "contacts" && id === MOCK_CONTACT_ID
          ? sampleContact(mode === "contact_pii")
          : type === "companies" && id === MOCK_COMPANY_ID
            ? sampleCompany()
            : type === "deals" && id === MOCK_DEAL_ID
              ? sampleDeal()
              : undefined;
      if (result === undefined) {
        jsonResponse(
          res,
          404,
          hubspotError(404, "Resource not found.", "OBJECT_NOT_FOUND"),
        );
        return;
      }
      jsonResponse(res, 200, result);
      return;
    }

    if (method === "POST" && searchMatch !== null) {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk as Buffer);
      }
      const bodyText = Buffer.concat(chunks).toString("utf8");
      try {
        lastSearchBody = JSON.parse(bodyText);
      } catch {
        lastSearchBody = undefined;
      }
      const type = searchMatch[1];
      const result =
        type === "contacts"
          ? sampleContact(mode === "contact_pii")
          : type === "companies"
            ? sampleCompany()
            : sampleDeal();
      jsonResponse(res, 200, {
        results: [result],
        paging: { next: { after: "search-page-2" } },
      });
      return;
    }

    if (
      method === "GET" &&
      pathname === `/crm/pipelines/${HUBSPOT_API_VERSION}/deals`
    ) {
      jsonResponse(res, 200, {
        results: [
          {
            id: "default",
            label: "Sales Pipeline",
            displayOrder: 0,
            stages: [
              {
                id: "appointmentscheduled",
                label: "Appointment Scheduled",
                displayOrder: 0,
              },
            ],
          },
        ],
      });
      return;
    }

    if (method === "GET" && pathname === `/crm/owners/${HUBSPOT_API_VERSION}`) {
      jsonResponse(res, 200, {
        results: [
          {
            id: "55",
            email: "owner@example.com",
            firstName: "Pat",
            lastName: "Owner",
          },
        ],
        paging: { next: { after: "owner-page-2" } },
      });
      return;
    }

    if (method === "GET" && associationMatch !== null) {
      jsonResponse(res, 200, {
        results: [
          {
            toObjectId: MOCK_COMPANY_ID,
            associationTypes: [{ category: "HUBSPOT_DEFINED", typeId: 1 }],
          },
        ],
      });
      return;
    }

    jsonResponse(res, 404, hubspotError(404, "Not found.", "NOT_FOUND"));
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      resolve();
    });
  });

  const address = server.address() as AddressInfo;
  const apiOrigin = `http://127.0.0.1:${address.port}`;

  return {
    apiOrigin,
    getLastAuthorization: () => lastAuthorization,
    getRequestCount: () => requestCount,
    getLastContactListUrl: () => lastContactListUrl,
    getLastSearchBody: () => lastSearchBody,
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
