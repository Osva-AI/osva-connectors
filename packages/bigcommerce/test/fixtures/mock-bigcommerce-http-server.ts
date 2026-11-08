import http from "node:http";
import type { AddressInfo } from "node:net";

export const FAKE_BIGCOMMERCE_ACCESS_TOKEN = "bc_fixture_access_token_0000";
export const FAKE_STORE_HASH = "fixture_store";

const PRODUCT = {
  data: {
    id: 101,
    name: "Fixture Product",
    sku: "SKU-BC",
    price: 19.99,
    type: "physical",
    availability: "available",
    is_visible: true,
  },
  meta: { pagination: { total: 1 } },
};

const ORDER = {
  id: 501,
  status: "Awaiting Fulfillment",
  status_id: 11,
  currency_code: "USD",
  total_inc_tax: "29.99",
  date_created: "Wed, 01 Jan 2024 00:00:00 +0000",
  payment_method: "Card",
  products: { url: "https://example.test", resource: "/orders/501/products" },
};

export interface MockBigcommerceHttpServer {
  readonly apiHost: string;
  readonly storeHash: string;
  getLastToken(): string | undefined;
  getLastPathname(): string | undefined;
  close(): Promise<void>;
}

function jsonResponse(res: http.ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export async function startMockBigcommerceHttpServer(): Promise<MockBigcommerceHttpServer> {
  let lastToken: string | undefined;
  let lastPathname: string | undefined;
  const prefix = `/stores/${FAKE_STORE_HASH}`;

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    lastPathname = url.pathname;
    lastToken = req.headers["x-auth-token"] as string | undefined;
    if (lastToken !== FAKE_BIGCOMMERCE_ACCESS_TOKEN) {
      jsonResponse(res, 401, { title: "Unauthorized" });
      return;
    }
    if (!url.pathname.startsWith(prefix)) {
      jsonResponse(res, 404, { title: "Not found" });
      return;
    }
    const relative = url.pathname.slice(prefix.length);
    if (req.method === "GET" && relative === "/v3/catalog/products") {
      jsonResponse(res, 200, { data: [PRODUCT.data], meta: PRODUCT.meta });
      return;
    }
    if (
      req.method === "GET" &&
      /^\/v3\/catalog\/products\/\d+$/.test(relative)
    ) {
      jsonResponse(res, 200, { data: PRODUCT.data });
      return;
    }
    if (
      req.method === "GET" &&
      /^\/v3\/catalog\/products\/\d+\/variants$/.test(relative)
    ) {
      jsonResponse(res, 200, {
        data: [{ id: 201, sku: "VAR" }],
        meta: { pagination: { total: 1 } },
      });
      return;
    }
    if (req.method === "GET" && relative === "/v3/catalog/trees") {
      jsonResponse(res, 200, { data: [{ id: 1, name: "Default" }] });
      return;
    }
    if (
      req.method === "GET" &&
      /^\/v3\/catalog\/trees\/\d+\/categories$/.test(relative)
    ) {
      jsonResponse(res, 200, {
        data: [{ category_id: 10, name: "Category", parent_id: 0 }],
        meta: { pagination: { total: 1 } },
      });
      return;
    }
    if (req.method === "GET" && relative === "/v2/orders") {
      jsonResponse(res, 200, [ORDER]);
      return;
    }
    if (req.method === "GET" && /^\/v2\/orders\/\d+$/.test(relative)) {
      jsonResponse(res, 200, ORDER);
      return;
    }
    if (
      req.method === "GET" &&
      /^\/v2\/orders\/\d+\/products$/.test(relative)
    ) {
      jsonResponse(res, 200, [{ id: 1, name: "Line item" }]);
      return;
    }
    if (
      req.method === "PUT" &&
      /^\/v3\/catalog\/products\/\d+$/.test(relative)
    ) {
      jsonResponse(res, 200, { data: { ...PRODUCT.data, price: 21.99 } });
      return;
    }
    if (req.method === "PUT" && /^\/v2\/orders\/\d+$/.test(relative)) {
      jsonResponse(res, 200, { ...ORDER, status_id: 2 });
      return;
    }
    jsonResponse(res, 404, { title: `No fixture ${relative}` });
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
  const apiHost = `http://127.0.0.1:${port}`;

  return {
    apiHost,
    storeHash: FAKE_STORE_HASH,
    getLastToken: () => lastToken,
    getLastPathname: () => lastPathname,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
