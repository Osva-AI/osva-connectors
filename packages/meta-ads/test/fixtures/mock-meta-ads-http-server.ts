import http from "node:http";
import type { AddressInfo } from "node:net";

export const FAKE_META_ADS_ACCESS_TOKEN =
  "EAAOSVA_fixture_meta_ads_access_token_0123456789";

export const MOCK_ACCOUNT_ID = "act_1234567890";

export type MockMetaAdsMode =
  | "success"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "rate_limit"
  | "rate_limit_once"
  | "server_error"
  | "invalid_json"
  | "oversized"
  | "malicious_paging"
  | "slow";

export interface MockMetaAdsHttpServer {
  readonly apiOrigin: string;
  getLastAuthorization(): string | undefined;
  getLastAppSecretProof(): string | undefined;
  getRequestCount(): number;
  setMode(mode: MockMetaAdsMode): void;
  close(): Promise<void>;
}

export interface StartMockMetaAdsHttpServerOptions {
  readonly expectedToken?: string;
  readonly mode?: MockMetaAdsMode;
  readonly slowDelayMs?: number;
}

function jsonResponse(res: http.ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function metaError(status: number, message: string, code: number) {
  return {
    error: {
      message,
      type: "OAuthException",
      code,
      fbtrace_id: "fixture-trace",
    },
  };
}

function parsePath(url: string): {
  pathname: string;
  searchParams: URLSearchParams;
} {
  const parsed = new URL(url, "http://127.0.0.1");
  return { pathname: parsed.pathname, searchParams: parsed.searchParams };
}

export async function startMockMetaAdsHttpServer(
  options: StartMockMetaAdsHttpServerOptions = {},
): Promise<MockMetaAdsHttpServer> {
  let mode: MockMetaAdsMode = options.mode ?? "success";
  let lastAuthorization: string | undefined;
  let lastAppSecretProof: string | undefined;
  let requestCount = 0;
  let rateLimitRetried = false;
  const expectedToken = options.expectedToken ?? FAKE_META_ADS_ACCESS_TOKEN;

  const server = http.createServer(async (req, res) => {
    requestCount += 1;
    const auth = req.headers.authorization;
    lastAuthorization = auth;

    if (mode === "slow") {
      await new Promise((resolve) =>
        setTimeout(resolve, options.slowDelayMs ?? 8_000),
      );
    }

    if (mode === "unauthorized" || auth !== `Bearer ${expectedToken}`) {
      if (mode !== "success" && mode !== "rate_limit_once") {
        jsonResponse(
          res,
          401,
          metaError(401, "Invalid OAuth access token.", 190),
        );
        return;
      }
      if (auth !== `Bearer ${expectedToken}`) {
        jsonResponse(
          res,
          401,
          metaError(401, "Invalid OAuth access token.", 190),
        );
        return;
      }
    }

    const { pathname, searchParams } = parsePath(req.url ?? "/");
    lastAppSecretProof = searchParams.get("appsecret_proof") ?? undefined;

    if (mode === "forbidden") {
      jsonResponse(res, 403, metaError(403, "Permission denied.", 10));
      return;
    }
    if (mode === "not_found") {
      jsonResponse(res, 404, metaError(404, "Unsupported get request.", 100));
      return;
    }
    if (mode === "rate_limit") {
      jsonResponse(res, 429, metaError(429, "User request limit reached.", 17));
      return;
    }
    if (mode === "rate_limit_once" && !rateLimitRetried) {
      rateLimitRetried = true;
      res.setHeader("Retry-After", "1");
      jsonResponse(res, 429, metaError(429, "User request limit reached.", 17));
      return;
    }
    if (mode === "server_error") {
      jsonResponse(res, 503, metaError(503, "Service unavailable.", 2));
      return;
    }
    if (mode === "invalid_json") {
      res.statusCode = 200;
      res.end("{not-json");
      return;
    }
    if (mode === "oversized") {
      res.statusCode = 200;
      res.end("x".repeat(3_000_000));
      return;
    }

    if (pathname.includes("/me/adaccounts")) {
      jsonResponse(res, 200, {
        data: [
          {
            account_id: "1234567890",
            name: "Fixture Ad Account",
            currency: "USD",
            timezone_name: "America/Los_Angeles",
            account_status: 1,
            amount_spent: "1234.56",
          },
        ],
        paging: {
          cursors: { after: "fixture-cursor-adaccounts" },
        },
      });
      return;
    }

    if (
      pathname.endsWith("/act_1234567890") ||
      /\/v26\.0\/act_1234567890$/.test(pathname)
    ) {
      jsonResponse(res, 200, {
        account_id: "1234567890",
        name: "Fixture Ad Account",
        currency: "USD",
        timezone_name: "America/Los_Angeles",
        account_status: 1,
        amount_spent: "1234.56",
        business_name: "Fixture Business",
      });
      return;
    }

    if (pathname.includes("/campaigns")) {
      jsonResponse(res, 200, {
        data: [
          {
            id: "9001",
            name: "Fixture Campaign",
            objective: "OUTCOME_TRAFFIC",
            status: "ACTIVE",
            effective_status: "ACTIVE",
            daily_budget: "5000",
          },
        ],
        paging: { cursors: {} },
      });
      return;
    }

    if (pathname.includes("/adsets")) {
      jsonResponse(res, 200, {
        data: [
          {
            id: "8001",
            name: "Fixture Ad Set",
            campaign_id: "9001",
            status: "ACTIVE",
            effective_status: "ACTIVE",
            optimization_goal: "LINK_CLICKS",
            billing_event: "IMPRESSIONS",
            targeting: { age_min: 18, age_max: 65, genders: [1] },
          },
        ],
        paging: { cursors: {} },
      });
      return;
    }

    if (
      pathname.includes("/ads") &&
      !pathname.includes("/adsets") &&
      !pathname.includes("/insights")
    ) {
      jsonResponse(res, 200, {
        data: [
          {
            id: "7001",
            name: "Fixture Ad",
            campaign_id: "9001",
            adset_id: "8001",
            status: "ACTIVE",
            effective_status: "ACTIVE",
            creative: { id: "6001", name: "Fixture Creative" },
          },
        ],
        paging: { cursors: {} },
      });
      return;
    }

    if (pathname.includes("/insights")) {
      if (mode === "malicious_paging") {
        jsonResponse(res, 200, {
          data: [
            {
              date_start: "2024-01-01",
              date_stop: "2024-01-01",
              spend: "12.34",
              impressions: "1000",
              clicks: "10",
              account_currency: "USD",
              actions: [{ action_type: "link_click", value: "8" }],
            },
          ],
          paging: {
            cursors: { after: "evil-cursor" },
            next: "https://evil.example.com/v26.0/act_1234567890/insights",
          },
        });
        return;
      }
      jsonResponse(res, 200, {
        data: [
          {
            date_start: "2024-01-01",
            date_stop: "2024-01-07",
            spend: "12.34",
            impressions: "1000",
            reach: "900",
            clicks: "10",
            ctr: "1.0",
            cpc: "1.23",
            cpm: "12.34",
            account_currency: "USD",
            actions: [
              { action_type: "link_click", value: "8" },
              { action_type: "purchase", value: "1" },
            ],
            action_values: [{ action_type: "purchase", value: "49.99" }],
          },
        ],
        paging: { cursors: {} },
      });
      return;
    }

    jsonResponse(res, 404, metaError(404, "Unknown path.", 100));
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => resolve());
    server.on("error", reject);
  });

  const address = server.address() as AddressInfo;
  const apiOrigin = `http://127.0.0.1:${address.port}`;

  return {
    apiOrigin,
    getLastAuthorization: () => lastAuthorization,
    getLastAppSecretProof: () => lastAppSecretProof,
    getRequestCount: () => requestCount,
    setMode: (next) => {
      mode = next;
    },
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
