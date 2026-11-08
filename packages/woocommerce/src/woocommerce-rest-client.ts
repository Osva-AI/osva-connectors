import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import {
  MAX_HTTP_REQUEST_BODY_BYTES,
  MAX_HTTP_RESPONSE_BYTES,
  READ_ONLY_MAX_RETRIES,
  READ_ONLY_RETRY_DELAY_MS,
} from "./constants.js";
import { buildWoocommerceBasicAuthHeader } from "./woocommerce-auth.js";
import type {
  WoocommerceClient,
  WoocommerceListParams,
} from "./woocommerce-client.js";

export interface WoocommerceHttpError {
  readonly kind: "http";
  readonly status: number;
  readonly wooMessage?: string;
  readonly retryAfterMs?: number;
}
const PATH_PATTERNS = [
  { method: "GET", pattern: /^\/products$/ },
  { method: "GET", pattern: /^\/products\/\d+$/ },
  { method: "PUT", pattern: /^\/products\/\d+$/ },
  { method: "GET", pattern: /^\/products\/\d+\/variations$/ },
  { method: "GET", pattern: /^\/products\/\d+\/variations\/\d+$/ },
  { method: "GET", pattern: /^\/products\/categories$/ },
  { method: "GET", pattern: /^\/orders$/ },
  { method: "GET", pattern: /^\/orders\/\d+$/ },
  { method: "GET", pattern: /^\/orders\/\d+\/notes$/ },
  { method: "PUT", pattern: /^\/orders\/\d+$/ },
];
function assertAllowedRelativePath(method: string, pathname: string): void {
  const normalized = pathname.replace(/\/$/, "") || "/";
  const allowed = PATH_PATTERNS.some(
    (entry) => entry.method === method && entry.pattern.test(normalized),
  );
  if (!allowed) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "WooCommerce request path is not supported.",
    );
  }
}
function assertAllowedApiUrl(
  pinnedOrigin: string,
  apiBaseUrl: string,
  url: string,
): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "WooCommerce request URL is invalid.",
    );
  }
  if (parsed.origin !== pinnedOrigin) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "WooCommerce request URL is not allowed.",
    );
  }
  const basePath = new URL(apiBaseUrl).pathname.replace(/\/$/, "");
  if (!parsed.pathname.startsWith(basePath)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "WooCommerce request URL is not allowed.",
    );
  }
}
async function readBoundedResponseText(
  response: Response,
  maxBytes: number,
  signal: AbortSignal | undefined,
): Promise<string> {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
  const lengthHeader = response.headers.get("content-length");
  if (lengthHeader !== null) {
    const declared = Number(lengthHeader);
    if (Number.isFinite(declared) && declared > maxBytes) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "WooCommerce response exceeds the connector size limit.",
      );
    }
  }
  if (response.body === null) {
    return "";
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    if (signal?.aborted) {
      await reader.cancel();
      throw new DOMException("Aborted", "AbortError");
    }
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (value === undefined) {
      continue;
    }
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "WooCommerce response exceeds the connector size limit.",
      );
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}
interface WoocommerceErrorBody {
  readonly message?: string;
}

function parseWoocommerceErrorBody(
  text: string,
): WoocommerceErrorBody | undefined {
  try {
    return JSON.parse(text) as WoocommerceErrorBody;
  } catch {
    return undefined;
  }
}
function parseRetryAfterMs(response: Response): number | undefined {
  const header = response.headers.get("retry-after");
  if (header === null) {
    return undefined;
  }
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1_000;
  }
  return undefined;
}
function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new DOMException("Aborted", "AbortError"));
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}
function buildQuery(params: WoocommerceListParams): URLSearchParams {
  const query = new URLSearchParams();
  query.set("page", String(params.page));
  query.set("per_page", String(params.perPage));
  if (params.search !== undefined) {
    query.set("search", params.search);
  }
  if (params.status !== undefined) {
    query.set("status", params.status);
  }
  if (params.category !== undefined) {
    query.set("category", String(params.category));
  }
  if (params.parent !== undefined) {
    query.set("parent", String(params.parent));
  }
  if (params.after !== undefined) {
    query.set("after", params.after);
  }
  if (params.before !== undefined) {
    query.set("before", params.before);
  }
  return query;
}
export interface CreateWoocommerceRestClientOptions {
  readonly apiBaseUrl: string;
  readonly pinnedOrigin: string;
  readonly consumerKey: string;
  readonly consumerSecret: string;
  readonly requestTimeoutMs: number;
  readonly fetchImpl?: typeof fetch;
}

export function createWoocommerceRestClient(
  options: CreateWoocommerceRestClientOptions,
): WoocommerceClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.apiBaseUrl.replace(/\/$/, "");
  const basePath = new URL(baseUrl).pathname.replace(/\/$/, "");
  const authHeader = buildWoocommerceBasicAuthHeader(
    options.consumerKey,
    options.consumerSecret,
  );
  async function requestJson(
    method: string,
    relativePathWithQuery: string,
    signal: AbortSignal | undefined,
    body?: Record<string, unknown>,
  ) {
    const pathOnly =
      relativePathWithQuery.split("?")[0] ?? relativePathWithQuery;
    const relative = pathOnly.startsWith(basePath)
      ? pathOnly.slice(basePath.length) || "/"
      : pathOnly.startsWith("/")
        ? pathOnly
        : `/${pathOnly}`;
    assertAllowedRelativePath(method, relative);
    const url = `${baseUrl}${relativePathWithQuery.startsWith("/") ? relativePathWithQuery : `/${relativePathWithQuery}`}`;
    assertAllowedApiUrl(
      options.pinnedOrigin,
      baseUrl,
      url.split("?")[0] ?? url,
    );
    let bodyText;
    if (body !== undefined) {
      bodyText = JSON.stringify(body);
      if (Buffer.byteLength(bodyText, "utf8") > MAX_HTTP_REQUEST_BODY_BYTES) {
        throw new ConnectorSdkError(
          "INVALID_INPUT",
          "WooCommerce update payload exceeds the size limit.",
        );
      }
    }
    let attempt = 0;
    for (;;) {
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        options.requestTimeoutMs,
      );
      const onAbort = () => controller.abort();
      signal?.addEventListener("abort", onAbort, { once: true });
      try {
        const response = await fetchImpl(url, {
          method,
          redirect: "manual",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: authHeader,
          },
          ...(bodyText !== undefined ? { body: bodyText } : {}),
          signal: controller.signal,
        });
        if (response.status >= 300 && response.status < 400) {
          throw new ConnectorSdkError(
            "PROVIDER_ERROR",
            "WooCommerce redirects are not followed.",
          );
        }
        const text = await readBoundedResponseText(
          response,
          MAX_HTTP_RESPONSE_BYTES,
          signal,
        );
        if (response.ok) {
          if (text.length === 0) {
            return { data: null, headers: response.headers };
          }
          try {
            return {
              data: JSON.parse(text),
              headers: response.headers,
            };
          } catch {
            throw new ConnectorSdkError(
              "PROVIDER_ERROR",
              "WooCommerce returned invalid JSON.",
            );
          }
        }
        const parsedBody = parseWoocommerceErrorBody(text);
        const httpError: WoocommerceHttpError = {
          kind: "http",
          status: response.status,
          ...(parsedBody?.message !== undefined
            ? { wooMessage: parsedBody.message }
            : {}),
          ...(parseRetryAfterMs(response) !== undefined
            ? { retryAfterMs: parseRetryAfterMs(response) }
            : {}),
        };
        const retriable =
          method === "GET" &&
          attempt < READ_ONLY_MAX_RETRIES &&
          (response.status === 429 ||
            response.status === 502 ||
            response.status === 503 ||
            response.status === 504);
        if (retriable) {
          attempt += 1;
          const delay = httpError.retryAfterMs ?? READ_ONLY_RETRY_DELAY_MS;
          await sleep(delay, signal);
          continue;
        }
        throw httpError;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          if (signal?.aborted) {
            throw error;
          }
          throw new ConnectorSdkError(
            "TIMEOUT",
            "WooCommerce request timed out.",
          );
        }
        throw error;
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
      }
    }
  }
  return {
    listProducts: async (params, signal) => {
      const { data, headers } = await requestJson(
        "GET",
        `/products?${buildQuery(params).toString()}`,
        signal,
      );
      return { items: data, headers };
    },
    getProduct: (productId, signal) =>
      requestJson("GET", `/products/${productId}`, signal).then((r) => r.data),
    listProductVariations: async (productId, params, signal) => {
      const { data, headers } = await requestJson(
        "GET",
        `/products/${productId}/variations?${buildQuery({ ...params, page: params.page, perPage: params.perPage }).toString()}`,
        signal,
      );
      return { items: data, headers };
    },
    getProductVariation: (productId, variationId, signal) =>
      requestJson(
        "GET",
        `/products/${productId}/variations/${variationId}`,
        signal,
      ).then((r) => r.data),
    listCategories: async (params, signal) => {
      const { data, headers } = await requestJson(
        "GET",
        `/products/categories?${buildQuery(params).toString()}`,
        signal,
      );
      return { items: data, headers };
    },
    listOrders: async (params, signal) => {
      const { data, headers } = await requestJson(
        "GET",
        `/orders?${buildQuery(params).toString()}`,
        signal,
      );
      return { items: data, headers };
    },
    getOrder: (orderId, signal) =>
      requestJson("GET", `/orders/${orderId}`, signal).then((r) => r.data),
    listOrderNotes: async (orderId, params, signal) => {
      const { data, headers } = await requestJson(
        "GET",
        `/orders/${orderId}/notes?${buildQuery({ ...params, page: params.page, perPage: params.perPage }).toString()}`,
        signal,
      );
      return { items: data, headers };
    },
    updateProduct: (productId, body, signal) =>
      requestJson("PUT", `/products/${productId}`, signal, body).then(
        (r) => r.data,
      ),
    updateOrderStatus: (orderId, body, signal) =>
      requestJson("PUT", `/orders/${orderId}`, signal, body).then(
        (r) => r.data,
      ),
  };
}
