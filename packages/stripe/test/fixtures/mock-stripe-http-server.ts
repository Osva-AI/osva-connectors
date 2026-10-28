import http from "node:http";
import type { AddressInfo } from "node:net";

import { STRIPE_API_VERSION } from "../../src/constants.js";
import { syntheticStripeTestSecretKey } from "../helpers/synthetic-stripe-keys.js";

export const FAKE_STRIPE_API_KEY = syntheticStripeTestSecretKey();

export const MOCK_CUSTOMER_ID = "cus_fixture001";
export const MOCK_PAYMENT_INTENT_ID = "pi_fixture001";
export const MOCK_CHARGE_ID = "ch_fixture001";
export const MOCK_REFUND_ID = "re_fixture001";
export const MOCK_SUBSCRIPTION_ID = "sub_fixture001";
export const MOCK_INVOICE_ID = "in_fixture001";
export const MOCK_BALANCE_TXN_ID = "txn_fixture001";

export type MockStripeMode =
  | "success"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "rate_limit"
  | "rate_limit_once"
  | "server_error"
  | "invalid_json"
  | "malicious_paging"
  | "pii_customer"
  | "livemode"
  | "slow";

export interface MockStripeHttpServer {
  readonly apiOrigin: string;
  getLastAuthorization(): string | undefined;
  getLastStripeVersion(): string | undefined;
  getRequestCount(): number;
  getLastListUrl(): string | undefined;
  setMode(mode: MockStripeMode): void;
  close(): Promise<void>;
}

export interface StartMockStripeHttpServerOptions {
  readonly expectedApiKey?: string;
  readonly mode?: MockStripeMode;
  readonly slowDelayMs?: number;
}

function jsonResponse(
  res: http.ServerResponse,
  status: number,
  body: unknown,
  requestId?: string,
) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (requestId !== undefined) {
    res.setHeader("Request-Id", requestId);
  }
  res.end(JSON.stringify(body));
}

function stripeError(
  status: number,
  type: string,
  message: string,
  code?: string,
) {
  return {
    error: {
      type,
      message,
      ...(code !== undefined ? { code } : {}),
    },
  };
}

function parseUrl(url: string): URL {
  return new URL(url, "http://127.0.0.1");
}

const accountFixture = {
  id: "acct_fixture001",
  object: "account",
  country: "US",
  default_currency: "usd",
  charges_enabled: true,
  payouts_enabled: true,
  details_submitted: true,
  livemode: false,
};

const balanceFixture = {
  object: "balance",
  available: [{ amount: 12_500, currency: "usd" }],
  pending: [{ amount: 300, currency: "usd" }],
  livemode: false,
};

const paymentIntentFixture = {
  id: MOCK_PAYMENT_INTENT_ID,
  object: "payment_intent",
  amount: 2500,
  amount_received: 2500,
  currency: "usd",
  status: "succeeded",
  created: 1_700_000_000,
  customer: MOCK_CUSTOMER_ID,
  livemode: false,
};

const chargeFixture = {
  id: MOCK_CHARGE_ID,
  object: "charge",
  amount: 2500,
  amount_captured: 2500,
  amount_refunded: 0,
  currency: "usd",
  captured: true,
  refunded: false,
  payment_intent: MOCK_PAYMENT_INTENT_ID,
  balance_transaction: MOCK_BALANCE_TXN_ID,
  status: "succeeded",
  created: 1_700_000_100,
  livemode: false,
};

const refundFixture = {
  id: MOCK_REFUND_ID,
  object: "refund",
  amount: 500,
  currency: "usd",
  status: "succeeded",
  reason: "requested_by_customer",
  charge: MOCK_CHARGE_ID,
  payment_intent: MOCK_PAYMENT_INTENT_ID,
  created: 1_700_000_200,
  livemode: false,
};

const subscriptionFixture = {
  id: MOCK_SUBSCRIPTION_ID,
  object: "subscription",
  status: "active",
  customer: MOCK_CUSTOMER_ID,
  cancel_at_period_end: false,
  canceled_at: null,
  ended_at: null,
  current_period_start: 1_700_000_000,
  current_period_end: 1_700_086_400,
  created: 1_690_000_000,
  livemode: false,
  items: {
    object: "list",
    data: [
      {
        id: "si_fixture001",
        object: "subscription_item",
        current_period_start: 1_700_000_000,
        current_period_end: 1_700_086_400,
        price: {
          id: "price_fixture001",
          object: "price",
          recurring: { interval: "month", interval_count: 1 },
        },
      },
    ],
  },
};

const invoiceFixture = {
  id: MOCK_INVOICE_ID,
  object: "invoice",
  customer: MOCK_CUSTOMER_ID,
  subscription: MOCK_SUBSCRIPTION_ID,
  status: "paid",
  subtotal: 2000,
  total: 2000,
  amount_paid: 2000,
  amount_due: 0,
  currency: "usd",
  created: 1_700_000_300,
  livemode: false,
};

const balanceTxnFixture = {
  id: MOCK_BALANCE_TXN_ID,
  object: "balance_transaction",
  amount: 2500,
  fee: 88,
  net: 2412,
  currency: "usd",
  type: "charge",
  source: MOCK_CHARGE_ID,
  status: "available",
  created: 1_700_000_150,
  livemode: false,
};

const customerFixture = {
  id: MOCK_CUSTOMER_ID,
  object: "customer",
  email: "secret@example.com",
  name: "Secret Name",
  phone: "+15551234567",
  created: 1_690_000_000,
  delinquent: false,
  currency: "usd",
  balance: 0,
  livemode: false,
  metadata: { ignore_agent: "DROP TABLE" },
};

function listResponse<T>(data: T[], hasMore = false) {
  return {
    object: "list",
    data,
    has_more: hasMore,
    url: "/v1/mock",
  };
}

export async function startMockStripeHttpServer(
  options: StartMockStripeHttpServerOptions = {},
): Promise<MockStripeHttpServer> {
  let mode: MockStripeMode = options.mode ?? "success";
  let lastAuthorization: string | undefined;
  let lastStripeVersion: string | undefined;
  let lastListUrl: string | undefined;
  let requestCount = 0;
  let rateLimitRetried = false;
  const expectedKey = options.expectedApiKey ?? FAKE_STRIPE_API_KEY;

  const server = http.createServer(async (req, res) => {
    requestCount += 1;
    lastAuthorization = req.headers.authorization;
    const versionHeader = req.headers["stripe-version"];
    lastStripeVersion = Array.isArray(versionHeader)
      ? versionHeader[0]
      : versionHeader;

    if (mode === "slow") {
      await new Promise((resolve) =>
        setTimeout(resolve, options.slowDelayMs ?? 8_000),
      );
    }

    if (req.method !== "GET") {
      jsonResponse(
        res,
        405,
        stripeError(405, "invalid_request_error", "Method not allowed."),
      );
      return;
    }

    const expectedAuth = `Bearer ${expectedKey}`;
    if (lastAuthorization !== expectedAuth) {
      jsonResponse(
        res,
        401,
        stripeError(401, "authentication_error", "Invalid API Key."),
      );
      return;
    }

    if (lastStripeVersion !== STRIPE_API_VERSION) {
      jsonResponse(
        res,
        400,
        stripeError(400, "invalid_request_error", "Invalid Stripe version."),
      );
      return;
    }

    if (mode === "unauthorized") {
      jsonResponse(
        res,
        401,
        stripeError(401, "authentication_error", "Invalid API Key."),
      );
      return;
    }

    if (mode === "forbidden") {
      jsonResponse(
        res,
        403,
        stripeError(
          403,
          "permission_error",
          "Permission denied.",
          "permission_denied",
        ),
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
        stripeError(429, "rate_limit_error", "Rate limit exceeded."),
      );
      return;
    }

    if (mode === "server_error") {
      jsonResponse(
        res,
        503,
        stripeError(503, "api_error", "Stripe is unavailable."),
        "req_fixture503",
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
    lastListUrl = req.url ?? undefined;

    if (mode === "malicious_paging" && pathname.includes("_transactions")) {
      jsonResponse(res, 200, {
        object: "list",
        data: [balanceTxnFixture],
        has_more: true,
        url: "https://evil.example/phish",
      });
      return;
    }

    if (pathname === "/v1/account") {
      jsonResponse(res, 200, accountFixture, "req_fixture_acct");
      return;
    }

    if (pathname === "/v1/balance") {
      jsonResponse(res, 200, balanceFixture, "req_fixture_bal");
      return;
    }

    if (pathname === "/v1/balance_transactions") {
      const startingAfter = parsed.searchParams.get("starting_after");
      if (startingAfter === MOCK_BALANCE_TXN_ID) {
        jsonResponse(res, 200, listResponse([]), "req_fixture_btxn_page2");
        return;
      }
      jsonResponse(
        res,
        200,
        listResponse([balanceTxnFixture], true),
        "req_fixture_btxn",
      );
      return;
    }

    if (pathname === "/v1/payment_intents") {
      jsonResponse(
        res,
        200,
        listResponse([paymentIntentFixture]),
        "req_fixture_pi_list",
      );
      return;
    }

    if (pathname.startsWith("/v1/payment_intents/")) {
      const id = pathname.split("/").pop();
      if (mode === "not_found" || id === "pi_missing") {
        jsonResponse(
          res,
          404,
          stripeError(404, "invalid_request_error", "No such payment_intent."),
        );
        return;
      }
      jsonResponse(res, 200, paymentIntentFixture, "req_fixture_pi_get");
      return;
    }

    if (pathname === "/v1/charges") {
      jsonResponse(res, 200, listResponse([chargeFixture]), "req_fixture_ch");
      return;
    }

    if (pathname === "/v1/refunds") {
      jsonResponse(res, 200, listResponse([refundFixture]), "req_fixture_re");
      return;
    }

    if (pathname === "/v1/subscriptions") {
      jsonResponse(
        res,
        200,
        listResponse([subscriptionFixture]),
        "req_fixture_sub",
      );
      return;
    }

    if (pathname === "/v1/invoices") {
      jsonResponse(res, 200, listResponse([invoiceFixture]), "req_fixture_in");
      return;
    }

    if (pathname.startsWith("/v1/customers/")) {
      const id = pathname.split("/").pop();
      if (mode === "not_found" || id === "cus_missing") {
        jsonResponse(
          res,
          404,
          stripeError(404, "invalid_request_error", "No such customer."),
        );
        return;
      }
      const customer =
        mode === "pii_customer"
          ? customerFixture
          : mode === "livemode"
            ? { ...customerFixture, livemode: true }
            : customerFixture;
      jsonResponse(res, 200, customer, "req_fixture_cus");
      return;
    }

    jsonResponse(
      res,
      404,
      stripeError(404, "invalid_request_error", "Unrecognized request URL."),
    );
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
    getLastStripeVersion: () => lastStripeVersion,
    getRequestCount: () => requestCount,
    getLastListUrl: () => lastListUrl,
    setMode: (next) => {
      mode = next;
    },
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
