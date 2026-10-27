import http from "node:http";
import type { AddressInfo } from "node:net";

export const FAKE_WHATSAPP_ACCESS_TOKEN =
  "EAAOSVA_fixture_whatsapp_access_token_0123456789";

export const MOCK_WABA_ID = "102290129340398";
export const MOCK_PHONE_NUMBER_ID = "109876543210";
export const MOCK_TEMPLATE_ID = "1234567890123";
export const MOCK_RECIPIENT = "15551234567";

export type MockWhatsAppMode =
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
  | "slow"
  | "send_timeout";

export interface MockWhatsAppHttpServer {
  readonly apiOrigin: string;
  getLastAuthorization(): string | undefined;
  getLastAppSecretProof(): string | undefined;
  getRequestCount(): number;
  getSendMessageCount(): number;
  setMode(mode: MockWhatsAppMode): void;
  close(): Promise<void>;
}

export interface StartMockWhatsAppHttpServerOptions {
  readonly expectedToken?: string;
  readonly mode?: MockWhatsAppMode;
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

const APPROVED_TEMPLATE = {
  id: MOCK_TEMPLATE_ID,
  name: "order_update",
  language: "en_US",
  status: "APPROVED",
  category: "UTILITY",
  components: [
    { type: "BODY", text: "Hello {{1}}, your order {{2}} is ready." },
  ],
};

const AUTH_TEMPLATE = {
  id: "9999999999999",
  name: "otp_code",
  language: "en_US",
  status: "APPROVED",
  category: "AUTHENTICATION",
  components: [{ type: "BODY", text: "Your code is {{1}}" }],
};

export async function startMockWhatsAppHttpServer(
  options: StartMockWhatsAppHttpServerOptions = {},
): Promise<MockWhatsAppHttpServer> {
  let mode: MockWhatsAppMode = options.mode ?? "success";
  let lastAuthorization: string | undefined;
  let lastAppSecretProof: string | undefined;
  let requestCount = 0;
  let sendMessageCount = 0;
  let rateLimitRetried = false;
  const expectedToken = options.expectedToken ?? FAKE_WHATSAPP_ACCESS_TOKEN;

  const server = http.createServer(async (req, res) => {
    requestCount += 1;
    const auth = req.headers.authorization;
    lastAuthorization = auth;

    if (mode === "slow" || mode === "send_timeout") {
      await new Promise((resolve) =>
        setTimeout(resolve, options.slowDelayMs ?? 8_000),
      );
    }

    if (auth !== `Bearer ${expectedToken}`) {
      jsonResponse(
        res,
        401,
        metaError(401, "Invalid OAuth access token.", 190),
      );
      return;
    }

    if (mode === "unauthorized") {
      jsonResponse(
        res,
        401,
        metaError(401, "Invalid OAuth access token.", 190),
      );
      return;
    }
    if (mode === "forbidden") {
      jsonResponse(res, 403, metaError(403, "Permission denied.", 10));
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
      jsonResponse(res, 429, metaError(429, "Rate limit exceeded.", 4));
      return;
    }
    if (mode === "server_error") {
      jsonResponse(res, 500, metaError(500, "Internal error.", 2));
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

    const { pathname, searchParams } = parsePath(req.url ?? "/");
    lastAppSecretProof = searchParams.get("appsecret_proof") ?? undefined;

    const segments = pathname.split("/").filter(Boolean);
    if (segments.length < 2 || segments[0] !== "v26.0") {
      jsonResponse(res, 404, metaError(404, "Unknown path.", 100));
      return;
    }

    const resourceId = segments[1];
    const subResource = segments[2];

    if (req.method === "POST" && subResource === "messages") {
      sendMessageCount += 1;
      if (mode === "send_timeout") {
        res.destroy();
        return;
      }
      let body = "";
      for await (const chunk of req) {
        body += chunk;
      }
      const parsed = JSON.parse(body) as {
        to?: string;
        template?: { name?: string };
      };
      if (Array.isArray(parsed)) {
        jsonResponse(res, 400, metaError(400, "Bulk not supported.", 100));
        return;
      }
      if (parsed.to === undefined) {
        jsonResponse(res, 400, metaError(400, "Missing recipient.", 100));
        return;
      }
      jsonResponse(res, 200, {
        messaging_product: "whatsapp",
        contacts: [{ input: parsed.to, wa_id: parsed.to }],
        messages: [{ id: "wamid.fixture123" }],
      });
      return;
    }

    if (req.method !== "GET") {
      jsonResponse(res, 405, metaError(405, "Method not allowed.", 100));
      return;
    }

    if (resourceId === MOCK_WABA_ID && subResource === "phone_numbers") {
      if (mode === "malicious_paging") {
        jsonResponse(res, 200, {
          data: [
            { id: MOCK_PHONE_NUMBER_ID, display_phone_number: "+1 555-0100" },
          ],
          paging: {
            cursors: { after: "cursor-after-fixture" },
            next: "https://evil.example.com/v26.0/next",
          },
        });
        return;
      }
      jsonResponse(res, 200, {
        data: [
          {
            id: MOCK_PHONE_NUMBER_ID,
            display_phone_number: "+1 555-0100",
            verified_name: "Fixture Shop",
            status: "CONNECTED",
          },
        ],
        paging: {
          cursors: {
            after: "QVFIUnhFixt1cmVAfter",
          },
        },
      });
      return;
    }

    if (resourceId === MOCK_WABA_ID && subResource === "message_templates") {
      const nameFilter = searchParams.get("name");
      const templates =
        nameFilter === "otp_code"
          ? [AUTH_TEMPLATE]
          : nameFilter === "order_update" || nameFilter === null
            ? [APPROVED_TEMPLATE]
            : [];
      jsonResponse(res, 200, { data: templates });
      return;
    }

    if (resourceId === MOCK_WABA_ID && subResource === "template_analytics") {
      jsonResponse(res, 200, {
        data: [
          {
            granularity: "DAILY",
            product_type: "cloud_api",
            data_points: [{ sent: 10, delivered: 9 }],
          },
        ],
      });
      return;
    }

    if (resourceId === MOCK_WABA_ID && subResource === undefined) {
      jsonResponse(res, 200, {
        id: MOCK_WABA_ID,
        name: "Fixture WABA",
        timezone_id: "1",
        account_review_status: "APPROVED",
      });
      return;
    }

    if (resourceId === MOCK_PHONE_NUMBER_ID && subResource === undefined) {
      jsonResponse(res, 200, {
        id: MOCK_PHONE_NUMBER_ID,
        display_phone_number: "+1 555-0100",
        verified_name: "Fixture Shop",
        status: "CONNECTED",
      });
      return;
    }

    if (
      resourceId === MOCK_PHONE_NUMBER_ID &&
      subResource === "whatsapp_business_profile"
    ) {
      jsonResponse(res, 200, {
        data: [
          {
            about: "We sell fixtures.",
            email: "support@example.com",
            vertical: "RETAIL",
          },
        ],
      });
      return;
    }

    if (resourceId === MOCK_TEMPLATE_ID && subResource === undefined) {
      jsonResponse(res, 200, APPROVED_TEMPLATE);
      return;
    }

    if (mode === "not_found") {
      jsonResponse(res, 404, metaError(404, "Unsupported get request.", 100));
      return;
    }

    jsonResponse(res, 404, metaError(404, "Unsupported get request.", 100));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  const apiOrigin = `http://127.0.0.1:${address.port}`;

  return {
    apiOrigin,
    getLastAuthorization: () => lastAuthorization,
    getLastAppSecretProof: () => lastAppSecretProof,
    getRequestCount: () => requestCount,
    getSendMessageCount: () => sendMessageCount,
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
