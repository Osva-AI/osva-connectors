import http from "node:http";
import type { AddressInfo } from "node:net";

export const FAKE_WOOCOMMERCE_CONSUMER_KEY = "ck_fixture_woocommerce_key";
export const FAKE_WOOCOMMERCE_CONSUMER_SECRET = "cs_fixture_woocommerce_secret";

export type MockWoocommerceMode =
  "success" | "unauthorized" | "not_found" | "rate_limit" | "server_error";

export interface MockWoocommerceHttpServer {
  readonly apiBaseUrl: string;
  readonly pinnedOrigin: string;
  getLastAuthorization(): string | undefined;
  getLastPathname(): string | undefined;
  getRequestCount(): number;
  setMode(mode: MockWoocommerceMode): void;
  close(): Promise<void>;
}

function expectedAuthHeader(): string {
  const token = Buffer.from(
    `${FAKE_WOOCOMMERCE_CONSUMER_KEY}:${FAKE_WOOCOMMERCE_CONSUMER_SECRET}`,
    "utf8",
  ).toString("base64");
  return `Basic ${token}`;
}

function jsonResponse(res: http.ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

const PRODUCT = {
  id: 101,
  name: "Fixture Product",
  slug: "fixture-product",
  sku: "SKU-101",
  status: "publish",
  type: "simple",
  price: "19.99",
  regular_price: "19.99",
  stock_status: "instock",
  permalink: "https://example.test/product/fixture-product",
};

const ORDER = {
  id: 501,
  status: "processing",
  currency: "USD",
  total: "29.99",
  date_created: "2024-01-01T00:00:00",
  date_modified: "2024-01-02T00:00:00",
  payment_method_title: "Card",
  line_items: [
    {
      id: 1,
      product_id: 101,
      name: "Item",
      quantity: 1,
      sku: "SKU",
      total: "29.99",
    },
  ],
};

export async function startMockWoocommerceHttpServer(): Promise<MockWoocommerceHttpServer> {
  let mode: MockWoocommerceMode = "success";
  let lastAuthorization: string | undefined;
  let lastPathname: string | undefined;
  let requestCount = 0;
  const expectedAuth = expectedAuthHeader();

  const server = http.createServer((req, res) => {
    requestCount += 1;
    lastAuthorization = req.headers.authorization;
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    lastPathname = url.pathname;

    if (lastAuthorization !== expectedAuth) {
      jsonResponse(res, 401, { message: "Unauthorized" });
      return;
    }

    if (mode === "unauthorized") {
      jsonResponse(res, 401, { message: "Unauthorized" });
      return;
    }
    if (mode === "not_found") {
      jsonResponse(res, 404, { message: "Not found" });
      return;
    }
    if (mode === "rate_limit") {
      res.setHeader("retry-after", "1");
      jsonResponse(res, 429, { message: "Rate limit" });
      return;
    }
    if (mode === "server_error") {
      jsonResponse(res, 500, { message: "Server error" });
      return;
    }

    if (req.method === "GET" && url.pathname.endsWith("/products")) {
      jsonResponse(res, 200, [PRODUCT]);
      return;
    }
    if (req.method === "GET" && /\/products\/\d+$/.test(url.pathname)) {
      jsonResponse(res, 200, PRODUCT);
      return;
    }
    if (
      req.method === "GET" &&
      /\/products\/\d+\/variations$/.test(url.pathname)
    ) {
      jsonResponse(res, 200, [
        { id: 201, sku: "VAR-201", regular_price: "9.99" },
      ]);
      return;
    }
    if (
      req.method === "GET" &&
      /\/products\/\d+\/variations\/\d+$/.test(url.pathname)
    ) {
      jsonResponse(res, 200, { id: 201, sku: "VAR-201" });
      return;
    }
    if (req.method === "GET" && url.pathname.endsWith("/products/categories")) {
      jsonResponse(res, 200, [
        {
          id: 10,
          name: "Fixture Category",
          slug: "fixture-category",
          parent: 0,
          count: 1,
        },
      ]);
      return;
    }
    if (req.method === "GET" && url.pathname.endsWith("/orders")) {
      jsonResponse(res, 200, [ORDER]);
      return;
    }
    if (req.method === "GET" && /\/orders\/\d+$/.test(url.pathname)) {
      jsonResponse(res, 200, ORDER);
      return;
    }
    if (req.method === "GET" && /\/orders\/\d+\/notes$/.test(url.pathname)) {
      jsonResponse(res, 200, [
        {
          id: 1,
          note: "Fixture note",
          customer_note: false,
          date_created: "2024-01-01",
        },
      ]);
      return;
    }
    if (req.method === "PUT" && /\/products\/\d+$/.test(url.pathname)) {
      jsonResponse(res, 200, { ...PRODUCT, regular_price: "21.99" });
      return;
    }
    if (req.method === "PUT" && /\/orders\/\d+$/.test(url.pathname)) {
      jsonResponse(res, 200, { ...ORDER, status: "completed" });
      return;
    }

    jsonResponse(res, 404, { message: `No fixture for ${url.pathname}` });
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", (err?: Error) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });

  const { port } = server.address() as AddressInfo;
  const origin = `http://127.0.0.1:${port}`;
  const apiBaseUrl = `${origin}/wp-json/wc/v3`;

  return {
    apiBaseUrl,
    pinnedOrigin: origin,
    getLastAuthorization: () => lastAuthorization,
    getLastPathname: () => lastPathname,
    getRequestCount: () => requestCount,
    setMode: (next) => {
      mode = next;
    },
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
