import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { computeAppSecretProof } from "./appsecret-proof.js";
import {
  MAX_HTTP_RESPONSE_BYTES,
  META_GRAPH_API_HOST,
  META_GRAPH_API_VERSION,
  READ_ONLY_MAX_RETRIES,
  READ_ONLY_RETRY_DELAY_MS,
} from "./constants.js";
import type { AllowedAnalyticsMetric } from "./analytics-allowlist.js";
import {
  assertPagingLinksSafe,
  extractAfterCursor,
  validatePaginationCursor,
} from "./pagination.js";

export interface WhatsAppGraphHttpError {
  readonly kind: "http";
  readonly status: number;
  readonly metaCode?: number;
  readonly metaSubcode?: number;
  readonly metaType?: string;
  readonly metaMessage?: string;
  readonly fbtraceId?: string;
  readonly retryAfterMs?: number;
}

interface MetaErrorBody {
  readonly error?: {
    readonly message?: string;
    readonly type?: string;
    readonly code?: number;
    readonly error_subcode?: number;
    readonly fbtrace_id?: string;
  };
}

export interface WhatsAppGraphListParams {
  readonly path: string;
  readonly fields: readonly string[];
  readonly limit: number;
  readonly after?: string;
  readonly extraQuery?: Readonly<Record<string, string>>;
  readonly signal?: AbortSignal;
}

export interface WhatsAppGraphGetParams {
  readonly path: string;
  readonly fields: readonly string[];
  readonly signal?: AbortSignal;
}

export interface WhatsAppTemplateAnalyticsParams {
  readonly wabaId: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly templateIds: readonly string[];
  readonly metricTypes: readonly AllowedAnalyticsMetric[];
  readonly useWabaTimezone?: boolean;
  readonly signal?: AbortSignal;
}

export interface WhatsAppSendTemplateParams {
  readonly phoneNumberId: string;
  readonly recipientE164: string;
  readonly templateName: string;
  readonly languageCode: string;
  readonly bodyParameters: readonly string[];
  readonly signal?: AbortSignal;
}

export interface WhatsAppGraphClient {
  getNode(params: WhatsAppGraphGetParams): Promise<unknown>;
  listEdge(params: WhatsAppGraphListParams): Promise<unknown>;
  getTemplateAnalytics(
    params: WhatsAppTemplateAnalyticsParams,
  ): Promise<unknown>;
  sendTemplateMessage(params: WhatsAppSendTemplateParams): Promise<unknown>;
}

export interface CreateWhatsAppGraphClientOptions {
  readonly accessToken: string;
  readonly appSecret?: string;
  readonly requestTimeoutMs: number;
  readonly apiHost?: string;
  readonly apiVersion?: string;
  readonly fetchImpl?: typeof fetch;
}

function assertAllowedApiUrl(url: string, apiHost: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "WhatsApp request URL is invalid.",
    );
  }
  const allowedHost = new URL(apiHost).host;
  const isLocalTest =
    parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  if (isLocalTest && apiHost.startsWith("http://")) {
    return;
  }
  if (parsed.protocol !== "https:" || parsed.host !== allowedHost) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "WhatsApp request URL is not allowlisted.",
    );
  }
}

function assertSafeGraphPath(path: string): void {
  if (path.length === 0 || path.startsWith("/") || path.includes("..")) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "WhatsApp request path is invalid.",
    );
  }
  if (path.includes("://")) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "WhatsApp request path must not be a URL.",
    );
  }
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
        "WhatsApp response exceeds the connector size limit.",
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
        "WhatsApp response exceeds the connector size limit.",
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

function parseMetaErrorBody(text: string): MetaErrorBody | undefined {
  try {
    return JSON.parse(text) as MetaErrorBody;
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
    (error as WhatsAppGraphHttpError).kind === "http"
  ) {
    const status = (error as WhatsAppGraphHttpError).status;
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

function buildHttpError(
  response: Response,
  text: string,
): WhatsAppGraphHttpError {
  const metaBody = parseMetaErrorBody(text);
  const retryAfterMs = parseRetryAfterMs(response);
  return {
    kind: "http",
    status: response.status,
    metaCode: metaBody?.error?.code,
    metaSubcode: metaBody?.error?.error_subcode,
    metaType: metaBody?.error?.type,
    metaMessage: metaBody?.error?.message,
    fbtraceId: metaBody?.error?.fbtrace_id,
    ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
  };
}

export function createWhatsAppGraphClient(
  options: CreateWhatsAppGraphClientOptions,
): WhatsAppGraphClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiHost = options.apiHost ?? META_GRAPH_API_HOST;
  const apiVersion = options.apiVersion ?? META_GRAPH_API_VERSION;
  const requestTimeoutMs = options.requestTimeoutMs;
  const accessToken = options.accessToken.trim();
  const appSecretProof =
    options.appSecret !== undefined
      ? computeAppSecretProof(accessToken, options.appSecret)
      : undefined;

  function buildUrl(path: string, query: Record<string, string>): string {
    assertSafeGraphPath(path);
    const url = new URL(`${apiHost}/${apiVersion}/${path}`);
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
    if (appSecretProof !== undefined) {
      url.searchParams.set("appsecret_proof", appSecretProof);
    }
    assertAllowedApiUrl(url.toString(), apiHost);
    return url.toString();
  }

  async function requestAttempt(
    url: string,
    init: {
      readonly method: "GET" | "POST";
      readonly body?: string;
      readonly signal?: AbortSignal;
    },
    attemptTimeoutMs: number,
  ): Promise<
    { readonly ok: true; readonly text: string } | WhatsAppGraphHttpError
  > {
    assertAllowedApiUrl(url, apiHost);

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort(new Error("WhatsApp request timed out."));
    }, attemptTimeoutMs);

    const onAbort = (): void => {
      controller.abort(init.signal?.reason);
    };
    if (init.signal !== undefined) {
      if (init.signal.aborted) {
        clearTimeout(timeout);
        throw new DOMException("Aborted", "AbortError");
      }
      init.signal.addEventListener("abort", onAbort, { once: true });
    }

    try {
      const response = await fetchImpl(url, {
        method: init.method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
          ...(init.body !== undefined
            ? { "Content-Type": "application/json" }
            : {}),
        },
        ...(init.body !== undefined ? { body: init.body } : {}),
        signal: controller.signal,
      });

      const text = await readBoundedResponseText(
        response,
        MAX_HTTP_RESPONSE_BYTES,
        controller.signal,
      );

      if (!response.ok) {
        return buildHttpError(response, text);
      }
      return { ok: true, text };
    } finally {
      clearTimeout(timeout);
      init.signal?.removeEventListener("abort", onAbort);
    }
  }

  async function requestJsonRead<T>(
    url: string,
    init: { readonly signal?: AbortSignal },
  ): Promise<T> {
    const deadlineMs = Date.now() + requestTimeoutMs;
    let attempt = 0;

    for (;;) {
      if (init.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      const remainingMs = deadlineMs - Date.now();
      if (remainingMs <= 0) {
        throw new Error("WhatsApp request timed out.");
      }

      try {
        const result = await requestAttempt(
          url,
          { method: "GET", signal: init.signal },
          remainingMs,
        );
        if ("kind" in result) {
          const canRetry =
            attempt < READ_ONLY_MAX_RETRIES &&
            (isRetryableHttpError(result) || false);
          if (!canRetry) {
            throw result;
          }
          attempt += 1;
          let delayMs = result.retryAfterMs ?? READ_ONLY_RETRY_DELAY_MS;
          delayMs = Math.min(delayMs, deadlineMs - Date.now());
          if (delayMs <= 0) {
            throw result;
          }
          await sleepMs(delayMs, init.signal);
          continue;
        }

        const text = result.text;
        if (text.length === 0) {
          return {} as T;
        }
        try {
          return JSON.parse(text) as T;
        } catch {
          throw new ConnectorSdkError(
            "PROVIDER_ERROR",
            "WhatsApp returned invalid JSON.",
          );
        }
      } catch (error) {
        if (error instanceof ConnectorSdkError) {
          throw error;
        }
        if (
          error !== null &&
          typeof error === "object" &&
          "kind" in error &&
          (error as WhatsAppGraphHttpError).kind === "http"
        ) {
          throw error;
        }
        const canRetry =
          attempt < READ_ONLY_MAX_RETRIES && isRetryableNetworkError(error);
        if (!canRetry) {
          throw error;
        }
        attempt += 1;
        const delayMs = Math.min(
          READ_ONLY_RETRY_DELAY_MS,
          deadlineMs - Date.now(),
        );
        if (delayMs <= 0) {
          throw error;
        }
        await sleepMs(delayMs, init.signal);
      }
    }
  }

  async function requestJsonWriteOnce<T>(
    url: string,
    body: string,
    init: { readonly signal?: AbortSignal },
  ): Promise<T> {
    if (init.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    const remainingMs = requestTimeoutMs;
    const result = await requestAttempt(
      url,
      { method: "POST", body, signal: init.signal },
      remainingMs,
    );
    if ("kind" in result) {
      throw result;
    }
    const text = result.text;
    if (text.length === 0) {
      return {} as T;
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "WhatsApp returned invalid JSON.",
      );
    }
  }

  return {
    getNode(params) {
      const url = buildUrl(params.path, {
        fields: params.fields.join(","),
      });
      return requestJsonRead(url, { signal: params.signal });
    },

    listEdge(params) {
      const query: Record<string, string> = {
        fields: params.fields.join(","),
        limit: String(params.limit),
      };
      const after = validatePaginationCursor(params.after);
      if (after !== undefined) {
        query.after = after;
      }
      if (params.extraQuery !== undefined) {
        for (const [key, value] of Object.entries(params.extraQuery)) {
          query[key] = value;
        }
      }
      const url = buildUrl(params.path, query);
      return requestJsonRead(url, { signal: params.signal });
    },

    getTemplateAnalytics(params) {
      const query: Record<string, string> = {
        start: params.startDate,
        end: params.endDate,
        granularity: "DAILY",
        template_ids: JSON.stringify([...params.templateIds]),
        metric_types: params.metricTypes.join(","),
        product_type: "CLOUD_API",
      };
      if (params.useWabaTimezone === true) {
        query.use_waba_timezone = "true";
      }
      const url = buildUrl(`${params.wabaId}/template_analytics`, query);
      return requestJsonRead(url, { signal: params.signal });
    },

    sendTemplateMessage(params) {
      const components =
        params.bodyParameters.length > 0
          ? [
              {
                type: "body",
                parameters: params.bodyParameters.map((text) => ({
                  type: "text",
                  text,
                })),
              },
            ]
          : undefined;

      const payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: params.recipientE164,
        type: "template",
        template: {
          name: params.templateName,
          language: { code: params.languageCode },
          ...(components !== undefined ? { components } : {}),
        },
      };

      const url = buildUrl(`${params.phoneNumberId}/messages`, {});
      return requestJsonWriteOnce(url, JSON.stringify(payload), {
        signal: params.signal,
      });
    },
  };
}

export function parseGraphListResponse(
  raw: unknown,
  apiHost: string,
): {
  data: unknown[];
  nextCursor: string | undefined;
} {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "WhatsApp returned an unexpected list payload.",
    );
  }
  const record = raw as { data?: unknown; paging?: unknown };
  assertPagingLinksSafe(record.paging, apiHost);
  const data = Array.isArray(record.data) ? record.data : [];
  const nextCursor = extractAfterCursor(record.paging);
  return { data, nextCursor };
}
