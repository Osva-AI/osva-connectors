import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  LIST_MAX_PAGE_SIZE,
  MAX_HTTP_RESPONSE_BYTES,
  READ_ONLY_MAX_RETRIES,
  READ_ONLY_RETRY_DELAY_MS,
  STRIPE_API_HOST,
  STRIPE_API_VERSION,
} from "./constants.js";
import { validatePaginationCursor } from "./pagination.js";
import { parseStripeResourceId } from "./resource-id.js";
import type { StripeClient } from "./stripe-client.js";

export interface StripeHttpError {
  readonly kind: "http";
  readonly status: number;
  readonly stripeMessage?: string;
  readonly stripeType?: string;
  readonly stripeCode?: string;
  readonly stripeRequestId?: string;
  readonly retryAfterMs?: number;
}

interface StripeErrorBody {
  readonly error?: {
    readonly message?: string;
    readonly type?: string;
    readonly code?: string;
  };
}

export interface CreateStripeRestClientOptions {
  readonly apiKey: string;
  readonly requestTimeoutMs: number;
  readonly apiHost?: string;
  readonly apiVersion?: string;
  readonly fetchImpl?: typeof fetch;
}

const PRODUCTION_HOSTNAME = "api.stripe.com";

const ALLOWED_GET_PREFIXES = [
  "/v1/account",
  "/v1/balance",
  "/v1/balance_transactions",
  "/v1/payment_intents",
  "/v1/charges",
  "/v1/refunds",
  "/v1/subscriptions",
  "/v1/invoices",
  "/v1/customers/",
] as const;

function assertAllowedApiUrl(url: string, apiHost: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Stripe request URL is invalid.",
    );
  }

  const onApi =
    url === apiHost ||
    url.startsWith(`${apiHost}/`) ||
    url.startsWith(`${apiHost.replace(/\/$/, "")}/`);
  if (!onApi) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Stripe request URL is not allowed.",
    );
  }

  if (apiHost === STRIPE_API_HOST) {
    if (parsed.protocol !== "https:") {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Stripe request URL is not allowed.",
      );
    }
    if (parsed.hostname !== PRODUCTION_HOSTNAME) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Stripe request URL is not allowed.",
      );
    }
  } else if (
    parsed.hostname !== "127.0.0.1" &&
    parsed.hostname !== "localhost" &&
    parsed.protocol !== "http:"
  ) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Stripe request URL is not allowed.",
    );
  }

  const pathname = parsed.pathname.replace(/\/$/, "") || "/";
  const allowed = ALLOWED_GET_PREFIXES.some((prefix) => {
    if (prefix.endsWith("/")) {
      return pathname.startsWith(prefix) && pathname.length > prefix.length;
    }
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });
  if (!allowed) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Stripe request path is not supported.",
    );
  }
}

function assertPageSize(limit: number): number {
  if (!Number.isInteger(limit) || limit < 1 || limit > LIST_MAX_PAGE_SIZE) {
    throw new ConnectorSdkError("INVALID_INPUT", "Page size is not valid.");
  }
  return limit;
}

async function readBoundedResponseText(
  response: Response,
  maxBytes: number,
  signal?: AbortSignal,
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
        "Stripe response exceeds the connector size limit.",
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
        "Stripe response exceeds the connector size limit.",
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

function parseStripeErrorBody(text: string): StripeErrorBody | undefined {
  try {
    return JSON.parse(text) as StripeErrorBody;
  } catch {
    return undefined;
  }
}

function sleepMs(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function parseRetryAfterMs(response: Response): number | undefined {
  const header = response.headers.get("retry-after");
  if (header === null) {
    return undefined;
  }
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1_000, 30_000);
  }
  return undefined;
}

function isRetryableHttpError(error: unknown): boolean {
  if (
    error !== null &&
    typeof error === "object" &&
    "kind" in error &&
    (error as StripeHttpError).kind === "http"
  ) {
    const status = (error as StripeHttpError).status;
    return status === 429 || status >= 500;
  }
  return false;
}

function isRetryableNetworkError(error: unknown): boolean {
  return (
    error instanceof TypeError ||
    (error instanceof Error &&
      (error.message.includes("fetch") || error.message.includes("network")))
  );
}

function sanitizeRequestId(header: string | null): string | undefined {
  if (header === null || header.length === 0) {
    return undefined;
  }
  const trimmed = header.trim();
  if (trimmed.length > 128 || !/^req_[A-Za-z0-9]+$/.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}

export function createStripeRestClient(
  options: CreateStripeRestClientOptions,
): StripeClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiHost = (options.apiHost ?? STRIPE_API_HOST).replace(/\/$/, "");
  const apiVersion = options.apiVersion ?? STRIPE_API_VERSION;
  const requestTimeoutMs = options.requestTimeoutMs;
  const apiKey = options.apiKey.trim();

  function buildListUrl(
    path: string,
    limit: number,
    startingAfter?: string,
    extraQuery?: Record<string, string>,
  ): string {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(`${apiHost}${normalizedPath}`);
    url.searchParams.set("limit", String(assertPageSize(limit)));
    const cursor = validatePaginationCursor(startingAfter);
    if (cursor !== undefined) {
      url.searchParams.set("starting_after", cursor);
    }
    if (extraQuery !== undefined) {
      for (const [key, value] of Object.entries(extraQuery)) {
        url.searchParams.set(key, value);
      }
    }
    assertAllowedApiUrl(url.toString(), apiHost);
    return url.toString();
  }

  function buildResourceUrl(path: string): string {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const url = `${apiHost}${normalizedPath}`;
    assertAllowedApiUrl(url, apiHost);
    return url;
  }

  async function requestJsonAttempt<T>(
    url: string,
    signal: AbortSignal | undefined,
    attemptTimeoutMs: number,
  ): Promise<{ body: T; requestId: string | undefined }> {
    assertAllowedApiUrl(url, apiHost);

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort(new Error("Stripe request timed out."));
    }, attemptTimeoutMs);

    const onAbort = (): void => {
      controller.abort(signal?.reason);
    };
    if (signal !== undefined) {
      if (signal.aborted) {
        clearTimeout(timeout);
        throw new DOMException("Aborted", "AbortError");
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }

    try {
      const response = await fetchImpl(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
          "Stripe-Version": apiVersion,
        },
        signal: controller.signal,
      });

      const text = await readBoundedResponseText(
        response,
        MAX_HTTP_RESPONSE_BYTES,
        controller.signal,
      );
      const requestId = sanitizeRequestId(response.headers.get("request-id"));

      if (!response.ok) {
        const stripeBody = parseStripeErrorBody(text);
        const err = stripeBody?.error;
        const retryAfterMs = parseRetryAfterMs(response);
        const httpError: StripeHttpError = {
          kind: "http",
          status: response.status,
          stripeMessage: err?.message,
          stripeType: err?.type,
          stripeCode: err?.code,
          stripeRequestId: requestId,
          ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
        };
        throw httpError;
      }

      if (text.length === 0) {
        return { body: {} as T, requestId };
      }
      try {
        return { body: JSON.parse(text) as T, requestId };
      } catch {
        throw new ConnectorSdkError(
          "PROVIDER_ERROR",
          "Stripe returned invalid JSON.",
        );
      }
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
    }
  }

  async function requestGet<T>(url: string, signal?: AbortSignal): Promise<T> {
    const deadlineMs = Date.now() + requestTimeoutMs;
    let attempt = 0;

    for (;;) {
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      const remainingMs = deadlineMs - Date.now();
      if (remainingMs <= 0) {
        throw new Error("Stripe request timed out.");
      }

      try {
        const result = await requestJsonAttempt<T>(url, signal, remainingMs);
        return result.body;
      } catch (error) {
        if (error instanceof ConnectorSdkError) {
          throw error;
        }

        const canRetry =
          attempt < READ_ONLY_MAX_RETRIES &&
          (isRetryableHttpError(error) || isRetryableNetworkError(error));
        if (!canRetry) {
          throw error;
        }

        attempt += 1;
        const remainingAfterError = deadlineMs - Date.now();
        if (remainingAfterError <= 0) {
          throw error;
        }

        let delayMs = READ_ONLY_RETRY_DELAY_MS;
        let retryAfterRequested: number | undefined;
        if (
          error !== null &&
          typeof error === "object" &&
          "kind" in error &&
          (error as StripeHttpError).kind === "http"
        ) {
          const httpError = error as StripeHttpError;
          retryAfterRequested = httpError.retryAfterMs;
          delayMs = httpError.retryAfterMs ?? READ_ONLY_RETRY_DELAY_MS;
        }
        if (
          retryAfterRequested !== undefined &&
          retryAfterRequested > remainingAfterError
        ) {
          throw error;
        }
        delayMs = Math.min(delayMs, remainingAfterError);
        await sleepMs(delayMs, signal);
      }
    }
  }

  function idPathSegment(id: string, label: string): string {
    return parseStripeResourceId(id, label);
  }

  return {
    getAccount(params) {
      return requestGet(buildResourceUrl("/v1/account"), params.signal);
    },

    getBalance(params) {
      return requestGet(buildResourceUrl("/v1/balance"), params.signal);
    },

    listBalanceTransactions(params) {
      const query: Record<string, string> = {};
      if (params.createdGte !== undefined) {
        query["created[gte]"] = String(params.createdGte);
      }
      if (params.createdLte !== undefined) {
        query["created[lte]"] = String(params.createdLte);
      }
      if (params.type !== undefined) {
        query.type = params.type;
      }
      const url = buildListUrl(
        "/v1/balance_transactions",
        params.limit,
        params.startingAfter,
        query,
      );
      return requestGet(url, params.signal);
    },

    listPaymentIntents(params) {
      const query: Record<string, string> = {};
      if (params.createdGte !== undefined) {
        query["created[gte]"] = String(params.createdGte);
      }
      if (params.createdLte !== undefined) {
        query["created[lte]"] = String(params.createdLte);
      }
      if (params.customer !== undefined) {
        query.customer = params.customer;
      }
      const url = buildListUrl(
        "/v1/payment_intents",
        params.limit,
        params.startingAfter,
        query,
      );
      return requestGet(url, params.signal);
    },

    getPaymentIntent(params) {
      const id = idPathSegment(params.id, "PaymentIntent ID");
      return requestGet(
        buildResourceUrl(`/v1/payment_intents/${encodeURIComponent(id)}`),
        params.signal,
      );
    },

    listCharges(params) {
      const query: Record<string, string> = {};
      if (params.createdGte !== undefined) {
        query["created[gte]"] = String(params.createdGte);
      }
      if (params.createdLte !== undefined) {
        query["created[lte]"] = String(params.createdLte);
      }
      if (params.customer !== undefined) {
        query.customer = params.customer;
      }
      if (params.paymentIntent !== undefined) {
        query.payment_intent = params.paymentIntent;
      }
      const url = buildListUrl(
        "/v1/charges",
        params.limit,
        params.startingAfter,
        query,
      );
      return requestGet(url, params.signal);
    },

    listRefunds(params) {
      const query: Record<string, string> = {};
      if (params.createdGte !== undefined) {
        query["created[gte]"] = String(params.createdGte);
      }
      if (params.createdLte !== undefined) {
        query["created[lte]"] = String(params.createdLte);
      }
      if (params.charge !== undefined) {
        query.charge = params.charge;
      }
      if (params.paymentIntent !== undefined) {
        query.payment_intent = params.paymentIntent;
      }
      const url = buildListUrl(
        "/v1/refunds",
        params.limit,
        params.startingAfter,
        query,
      );
      return requestGet(url, params.signal);
    },

    listSubscriptions(params) {
      const query: Record<string, string> = {};
      if (params.customer !== undefined) {
        query.customer = params.customer;
      }
      if (params.status !== undefined) {
        query.status = params.status;
      }
      if (params.createdGte !== undefined) {
        query["created[gte]"] = String(params.createdGte);
      }
      if (params.createdLte !== undefined) {
        query["created[lte]"] = String(params.createdLte);
      }
      const url = buildListUrl(
        "/v1/subscriptions",
        params.limit,
        params.startingAfter,
        query,
      );
      return requestGet(url, params.signal);
    },

    listInvoices(params) {
      const query: Record<string, string> = {};
      if (params.customer !== undefined) {
        query.customer = params.customer;
      }
      if (params.subscription !== undefined) {
        query.subscription = params.subscription;
      }
      if (params.status !== undefined) {
        query.status = params.status;
      }
      if (params.createdGte !== undefined) {
        query["created[gte]"] = String(params.createdGte);
      }
      if (params.createdLte !== undefined) {
        query["created[lte]"] = String(params.createdLte);
      }
      const url = buildListUrl(
        "/v1/invoices",
        params.limit,
        params.startingAfter,
        query,
      );
      return requestGet(url, params.signal);
    },

    getCustomer(params) {
      const id = idPathSegment(params.id, "Customer ID");
      if (!id.startsWith("cus_")) {
        throw new ConnectorSdkError(
          "INVALID_INPUT",
          "Customer ID is not valid.",
        );
      }
      return requestGet(
        buildResourceUrl(`/v1/customers/${encodeURIComponent(id)}`),
        params.signal,
      );
    },
  };
}
