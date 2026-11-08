import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import {
  MAX_HTTP_REQUEST_BODY_BYTES,
  MAX_HTTP_RESPONSE_BYTES,
  READ_ONLY_MAX_RETRIES,
  READ_ONLY_RETRY_DELAY_MS,
} from "./constants.js";
import type { BigcommerceClient } from "./bigcommerce-client.js";

export interface BigcommerceHttpError {
  readonly kind: "http";
  readonly status: number;
  readonly bcMessage?: string;
  readonly retryAfterMs?: number;
}
const PATH_PATTERNS = [
  { method: "GET", pattern: /^\/v3\/catalog\/products$/ },
  { method: "GET", pattern: /^\/v3\/catalog\/products\/\d+$/ },
  { method: "PUT", pattern: /^\/v3\/catalog\/products\/\d+$/ },
  { method: "GET", pattern: /^\/v3\/catalog\/products\/\d+\/variants$/ },
  { method: "GET", pattern: /^\/v3\/catalog\/trees$/ },
  { method: "GET", pattern: /^\/v3\/catalog\/trees\/\d+\/categories$/ },
  { method: "GET", pattern: /^\/v2\/orders$/ },
  { method: "GET", pattern: /^\/v2\/orders\/\d+$/ },
  { method: "GET", pattern: /^\/v2\/orders\/\d+\/products$/ },
  { method: "PUT", pattern: /^\/v2\/orders\/\d+$/ },
];
export interface CreateBigcommerceRestClientOptions {
  readonly apiHost: string;
  readonly storeHash: string;
  readonly accessToken: string;
  readonly requestTimeoutMs: number;
  readonly fetchImpl?: typeof fetch;
}

export function createBigcommerceRestClient(
  options: CreateBigcommerceRestClientOptions,
): BigcommerceClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const storePrefix = `${options.apiHost.replace(/\/$/, "")}/stores/${options.storeHash}`;
  function assertAllowedRequest(method: string, fullUrl: string): void {
    const parsed = new URL(fullUrl);
    if (parsed.origin !== new URL(options.apiHost).origin) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "BigCommerce request URL is not allowed.",
      );
    }
    if (!fullUrl.startsWith(storePrefix)) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "BigCommerce request URL is not allowed.",
      );
    }
    const relative = fullUrl.slice(storePrefix.length).split("?")[0] ?? "/";
    const allowed = PATH_PATTERNS.some(
      (entry) => entry.method === method && entry.pattern.test(relative),
    );
    if (!allowed) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "BigCommerce request path is not supported.",
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
          "BigCommerce response exceeds the connector size limit.",
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
      if (done) break;
      if (value === undefined) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new ConnectorSdkError(
          "PROVIDER_ERROR",
          "BigCommerce response exceeds the connector size limit.",
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
  function parseRateLimitResetMs(response: Response): number | undefined {
    const raw = response.headers.get("x-rate-limit-time-reset-ms");
    if (raw === null) return undefined;
    const ms = Number(raw);
    return Number.isFinite(ms) && ms >= 0 ? ms : undefined;
  }
  async function requestJson(
    method: string,
    path: string,
    signal: AbortSignal | undefined,
    body?: Record<string, unknown>,
  ) {
    const url = `${storePrefix}${path.startsWith("/") ? path : `/${path}`}`;
    assertAllowedRequest(method, url);
    let bodyText;
    if (body !== undefined) {
      bodyText = JSON.stringify(body);
      if (Buffer.byteLength(bodyText, "utf8") > MAX_HTTP_REQUEST_BODY_BYTES) {
        throw new ConnectorSdkError(
          "INVALID_INPUT",
          "BigCommerce update payload exceeds the size limit.",
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
            "X-Auth-Token": options.accessToken,
          },
          ...(bodyText !== undefined ? { body: bodyText } : {}),
          signal: controller.signal,
        });
        if (response.status >= 300 && response.status < 400) {
          throw new ConnectorSdkError(
            "PROVIDER_ERROR",
            "BigCommerce redirects are not followed.",
          );
        }
        const text = await readBoundedResponseText(
          response,
          MAX_HTTP_RESPONSE_BYTES,
          signal,
        );
        if (response.ok) {
          if (text.length === 0) return null;
          try {
            return JSON.parse(text);
          } catch {
            throw new ConnectorSdkError(
              "PROVIDER_ERROR",
              "BigCommerce returned invalid JSON.",
            );
          }
        }
        let bcMessage: string | undefined;
        try {
          const parsed = JSON.parse(text) as {
            detail?: string;
            title?: string;
          };
          bcMessage = parsed.detail ?? parsed.title;
        } catch {
          bcMessage = undefined;
        }
        const httpError: BigcommerceHttpError = {
          kind: "http",
          status: response.status,
          ...(bcMessage !== undefined ? { bcMessage } : {}),
          ...(parseRateLimitResetMs(response) !== undefined
            ? { retryAfterMs: parseRateLimitResetMs(response) }
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
          await new Promise((resolve, reject) => {
            const delay = httpError.retryAfterMs ?? READ_ONLY_RETRY_DELAY_MS;
            const timerId = setTimeout(resolve, delay);
            signal?.addEventListener(
              "abort",
              () => {
                clearTimeout(timerId);
                reject(new DOMException("Aborted", "AbortError"));
              },
              { once: true },
            );
          });
          continue;
        }
        throw httpError;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          if (signal?.aborted) throw error;
          throw new ConnectorSdkError(
            "TIMEOUT",
            "BigCommerce request timed out.",
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
      const query = new URLSearchParams();
      query.set("page", String(params.page));
      query.set("limit", String(params.limit));
      if (params.search !== undefined) query.set("keyword", params.search);
      return {
        envelope: await requestJson(
          "GET",
          `/v3/catalog/products?${query.toString()}`,
          signal,
        ),
      };
    },
    getProduct: (productId, signal) =>
      requestJson("GET", `/v3/catalog/products/${productId}`, signal),
    listProductVariants: async (productId, params, signal) => ({
      envelope: await requestJson(
        "GET",
        `/v3/catalog/products/${productId}/variants?${new URLSearchParams({
          page: String(params.page),
          limit: String(params.limit),
        }).toString()}`,
        signal,
      ),
    }),
    listCategoryTrees: async (signal) => ({
      envelope: await requestJson("GET", "/v3/catalog/trees", signal),
    }),
    listCategoriesInTree: async (treeId, params, signal) => {
      const query = new URLSearchParams();
      query.set("page", String(params.page));
      query.set("limit", String(params.limit));
      if (params.parentId !== undefined) {
        query.set("parent_id", String(params.parentId));
      }
      return {
        envelope: await requestJson(
          "GET",
          `/v3/catalog/trees/${treeId}/categories?${query.toString()}`,
          signal,
        ),
      };
    },
    listOrders: async (params, signal) => {
      const query = new URLSearchParams();
      query.set("page", String(params.page));
      query.set("limit", String(params.limit));
      if (params.minDateCreated) {
        query.set("min_date_created", params.minDateCreated);
      }
      if (params.maxDateCreated) {
        query.set("max_date_created", params.maxDateCreated);
      }
      return requestJson("GET", `/v2/orders?${query.toString()}`, signal);
    },
    getOrder: (orderId, signal) =>
      requestJson("GET", `/v2/orders/${orderId}`, signal),
    listOrderProducts: (orderId, signal) =>
      requestJson("GET", `/v2/orders/${orderId}/products`, signal),
    updateProduct: (productId, body, signal) =>
      requestJson("PUT", `/v3/catalog/products/${productId}`, signal, body),
    updateOrderStatus: (orderId, body, signal) =>
      requestJson("PUT", `/v2/orders/${orderId}`, signal, body),
  };
}
