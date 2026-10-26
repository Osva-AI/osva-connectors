import http from "node:http";
import type { AddressInfo } from "node:net";

export const FAKE_GOOGLE_ADS_ACCESS_TOKEN =
  "ya29.osva_fixture_google_ads_access";

export const MOCK_CUSTOMER_ID = "1234567890";

export type MockGoogleAdsMode =
  | "success"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "rate_limit"
  | "rate_limit_once"
  | "server_error"
  | "invalid_json"
  | "oversized"
  | "slow"
  | "injection_query";

export interface MockGoogleAdsHttpServer {
  readonly apiOrigin: string;
  getLastAuthorization(): string | undefined;
  getLastLoginCustomerId(): string | undefined;
  getLastDeveloperToken(): string | undefined;
  getRequestCount(): number;
  setMode(mode: MockGoogleAdsMode): void;
  close(): Promise<void>;
}

export interface StartMockGoogleAdsHttpServerOptions {
  readonly expectedToken?: string;
  readonly mode?: MockGoogleAdsMode;
  readonly slowDelayMs?: number;
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

function searchRow(partial: Record<string, unknown>) {
  return partial;
}

function defaultSearchResults(query: string) {
  const lower = query.toLowerCase();
  if (lower.includes("from customer")) {
    return [
      searchRow({
        customer: {
          id: MOCK_CUSTOMER_ID,
          descriptiveName: "Fixture Ads Customer",
          currencyCode: "USD",
          timeZone: "America/Los_Angeles",
          manager: false,
          status: "ENABLED",
        },
      }),
    ];
  }
  if (lower.includes("from campaign")) {
    return [
      searchRow({
        campaign: {
          id: "1001",
          name: "Fixture Campaign",
          status: "ENABLED",
          advertisingChannelType: "SEARCH",
          startDate: "2024-01-01",
          endDate: "2037-12-30",
        },
        segments: { date: "2024-01-15" },
        metrics: {
          impressions: "1000",
          clicks: "50",
          costMicros: "2500000",
          conversions: "3",
          conversionsValue: "120.5",
          ctr: "0.05",
        },
      }),
    ];
  }
  if (lower.includes("from ad_group")) {
    return [
      searchRow({
        adGroup: {
          id: "2001",
          name: "Fixture Ad Group",
          status: "ENABLED",
        },
        campaign: { id: "1001", name: "Fixture Campaign" },
        segments: { date: "2024-01-15" },
        metrics: {
          impressions: "500",
          clicks: "20",
          costMicros: "900000",
          conversions: "1",
          conversionsValue: "40",
          ctr: "0.04",
        },
      }),
    ];
  }
  if (lower.includes("from keyword_view")) {
    return [
      searchRow({
        adGroupCriterion: {
          criterionId: "3001",
          keyword: { text: "fixture keyword", matchType: "EXACT" },
          status: "ENABLED",
        },
        adGroup: { id: "2001", name: "Fixture Ad Group" },
        campaign: { id: "1001" },
        segments: { date: "2024-01-15" },
        metrics: {
          impressions: "100",
          clicks: "5",
          costMicros: "100000",
          conversions: "0",
          conversionsValue: "0",
          ctr: "0.05",
        },
      }),
    ];
  }
  if (lower.includes("from search_term_view")) {
    return [
      searchRow({
        searchTermView: {
          searchTerm: "fixture search",
          status: "NONE",
        },
        campaign: { id: "1001" },
        adGroup: { id: "2001" },
        segments: { date: "2024-01-15" },
        metrics: {
          impressions: "80",
          clicks: "4",
          costMicros: "80000",
          conversions: "0",
          conversionsValue: "0",
          ctr: "0.05",
        },
      }),
    ];
  }
  if (lower.includes("from ad_group_ad_asset_view")) {
    return [
      searchRow({
        asset: { id: "4001", name: "Fixture Asset", type: "TEXT" },
        adGroupAdAssetView: {
          fieldType: "HEADLINE",
          performanceLabel: "GOOD",
        },
        campaign: { id: "1001" },
        adGroup: { id: "2001" },
        segments: { date: "2024-01-15" },
        metrics: {
          impressions: "200",
          clicks: "10",
          costMicros: "200000",
          conversions: "1",
          conversionsValue: "25",
          ctr: "0.05",
        },
      }),
    ];
  }
  return [];
}

export async function startMockGoogleAdsHttpServer(
  options: StartMockGoogleAdsHttpServerOptions = {},
): Promise<MockGoogleAdsHttpServer> {
  let mode: MockGoogleAdsMode = options.mode ?? "success";
  let requestCount = 0;
  let lastAuthorization: string | undefined;
  let lastLoginCustomerId: string | undefined;
  let lastDeveloperToken: string | undefined;
  let rateLimitConsumed = false;

  const server = http.createServer(async (req, res) => {
    requestCount += 1;
    lastAuthorization = req.headers.authorization;
    lastLoginCustomerId =
      typeof req.headers["login-customer-id"] === "string"
        ? req.headers["login-customer-id"]
        : undefined;
    lastDeveloperToken =
      typeof req.headers["developer-token"] === "string"
        ? req.headers["developer-token"]
        : undefined;

    const expected = options.expectedToken ?? FAKE_GOOGLE_ADS_ACCESS_TOKEN;
    if (req.headers.authorization !== `Bearer ${expected}`) {
      jsonResponse(
        res,
        401,
        googleError(401, "Invalid Credentials", "UNAUTHENTICATED"),
      );
      return;
    }

    if (mode === "slow") {
      await new Promise((resolve) =>
        setTimeout(resolve, options.slowDelayMs ?? 8_000),
      );
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
        googleError(403, "User permission denied", "PERMISSION_DENIED"),
      );
      return;
    }
    if (mode === "not_found") {
      jsonResponse(res, 404, googleError(404, "Not found", "NOT_FOUND"));
      return;
    }
    if (
      mode === "rate_limit" ||
      (mode === "rate_limit_once" && !rateLimitConsumed)
    ) {
      if (mode === "rate_limit_once") {
        rateLimitConsumed = true;
      }
      res.setHeader("Retry-After", "1");
      jsonResponse(
        res,
        429,
        googleError(429, "Quota exceeded", "RESOURCE_EXHAUSTED"),
      );
      return;
    }
    if (mode === "server_error") {
      jsonResponse(
        res,
        503,
        googleError(503, "Backend unavailable", "UNAVAILABLE"),
      );
      return;
    }
    if (mode === "invalid_json") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end("{not-json");
      return;
    }
    if (mode === "oversized") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(`{"results":[${'"x":'.repeat(500_000)}`);
      return;
    }

    const url = req.url ?? "/";
    if (
      req.method === "GET" &&
      url.includes("customers:listAccessibleCustomers")
    ) {
      jsonResponse(res, 200, {
        resourceNames: [
          `customers/${MOCK_CUSTOMER_ID}`,
          "customers/9999999999",
        ],
      });
      return;
    }

    if (req.method === "POST" && url.includes("/googleAds:search")) {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk as Buffer);
      }
      const bodyText = Buffer.concat(chunks).toString("utf8");
      let body: { query?: string; pageToken?: string } = {};
      try {
        body = JSON.parse(bodyText) as { query?: string; pageToken?: string };
      } catch {
        jsonResponse(
          res,
          400,
          googleError(400, "Invalid JSON body", "INVALID_ARGUMENT"),
        );
        return;
      }

      const query = body.query ?? "";
      if (mode === "injection_query" && query.includes("DROP")) {
        jsonResponse(
          res,
          400,
          googleError(400, "Rejected", "INVALID_ARGUMENT"),
        );
        return;
      }

      if (body.pageToken === "page-2") {
        jsonResponse(res, 200, { results: [], fieldMask: "campaign.id" });
        return;
      }

      jsonResponse(res, 200, {
        results: defaultSearchResults(query),
        nextPageToken: "page-2",
        fieldMask: "campaign.id,campaign.name",
      });
      return;
    }

    jsonResponse(res, 404, googleError(404, "Unknown route", "NOT_FOUND"));
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address() as AddressInfo;
  const apiOrigin = `http://127.0.0.1:${address.port}`;

  return {
    apiOrigin,
    getLastAuthorization: () => lastAuthorization,
    getLastLoginCustomerId: () => lastLoginCustomerId,
    getLastDeveloperToken: () => lastDeveloperToken,
    getRequestCount: () => requestCount,
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
