import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  EVENT_LIST_SPARSE_FIELDS,
  KLAVIYO_API_HOST,
  KLAVIYO_API_REVISION,
  MAX_FILTER_STRING_LENGTH,
  MAX_HTTP_RESPONSE_BYTES,
  READ_ONLY_MAX_RETRIES,
  READ_ONLY_RETRY_DELAY_MS,
} from "./constants.js";
import type { KlaviyoClient } from "./klaviyo-client.js";
import { validatePaginationCursor } from "./pagination.js";
import { parseKlaviyoResourceId } from "./resource-id.js";

export interface KlaviyoHttpError {
  readonly kind: "http";
  readonly status: number;
  readonly klaviyoTitle?: string;
  readonly klaviyoDetail?: string;
  readonly klaviyoCode?: string;
  readonly retryAfterMs?: number;
}

interface KlaviyoErrorBody {
  readonly errors?: ReadonlyArray<{
    readonly status?: number;
    readonly code?: string;
    readonly title?: string;
    readonly detail?: string;
  }>;
}

export interface CreateKlaviyoRestClientOptions {
  readonly privateApiKey: string;
  readonly requestTimeoutMs: number;
  readonly apiHost?: string;
  readonly apiRevision?: string;
  readonly fetchImpl?: typeof fetch;
}

const PRODUCTION_HOSTNAME = "a.klaviyo.com";

function assertAllowedApiUrl(url: string, apiHost: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Klaviyo request URL is invalid.",
    );
  }

  const onApi =
    url === apiHost ||
    url.startsWith(`${apiHost}/`) ||
    url.startsWith(`${apiHost.replace(/\/$/, "")}/`);
  if (!onApi) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Klaviyo request URL is not allowed.",
    );
  }

  if (apiHost === KLAVIYO_API_HOST) {
    if (parsed.protocol !== "https:") {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Klaviyo request URL is not allowed.",
      );
    }
    if (parsed.hostname !== PRODUCTION_HOSTNAME) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Klaviyo request URL is not allowed.",
      );
    }
    return;
  }

  if (
    parsed.hostname !== "127.0.0.1" &&
    parsed.hostname !== "localhost" &&
    parsed.protocol !== "http:"
  ) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Klaviyo request URL is not allowed.",
    );
  }
}

function assertSafeResourcePathSegment(segment: string, label: string): string {
  return parseKlaviyoResourceId(segment, label);
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
        "Klaviyo response exceeds the connector size limit.",
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
        "Klaviyo response exceeds the connector size limit.",
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

function parseKlaviyoErrorBody(text: string): KlaviyoErrorBody | undefined {
  try {
    return JSON.parse(text) as KlaviyoErrorBody;
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
    (error as KlaviyoHttpError).kind === "http"
  ) {
    const status = (error as KlaviyoHttpError).status;
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

export function createKlaviyoRestClient(
  options: CreateKlaviyoRestClientOptions,
): KlaviyoClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiHost = (options.apiHost ?? KLAVIYO_API_HOST).replace(/\/$/, "");
  const apiRevision = options.apiRevision ?? KLAVIYO_API_REVISION;
  const requestTimeoutMs = options.requestTimeoutMs;
  const privateApiKey = options.privateApiKey.trim();

  function buildListUrl(
    path: string,
    pageSize: number,
    pageCursor?: string,
    extraQuery?: Record<string, string>,
  ): string {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(`${apiHost}${normalizedPath}`);
    url.searchParams.set("page[size]", String(pageSize));
    const cursor = validatePaginationCursor(pageCursor);
    if (cursor !== undefined) {
      url.searchParams.set("page[cursor]", cursor);
    }
    if (extraQuery !== undefined) {
      for (const [key, value] of Object.entries(extraQuery)) {
        url.searchParams.set(key, value);
      }
    }
    assertAllowedApiUrl(url.toString(), apiHost);
    return url.toString();
  }

  async function requestJsonAttempt<T>(
    url: string,
    init: {
      readonly method: "GET" | "POST";
      readonly body?: unknown;
      readonly signal?: AbortSignal;
    },
    attemptTimeoutMs: number,
  ): Promise<T> {
    assertAllowedApiUrl(url, apiHost);

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort(new Error("Klaviyo request timed out."));
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
          Authorization: `Klaviyo-API-Key ${privateApiKey}`,
          Accept: "application/vnd.api+json",
          revision: apiRevision,
          ...(init.body !== undefined
            ? { "Content-Type": "application/vnd.api+json" }
            : {}),
        },
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        signal: controller.signal,
      });

      const text = await readBoundedResponseText(
        response,
        MAX_HTTP_RESPONSE_BYTES,
        controller.signal,
      );

      if (!response.ok) {
        const klaviyoBody = parseKlaviyoErrorBody(text);
        const first = klaviyoBody?.errors?.[0];
        const retryAfterMs = parseRetryAfterMs(response);
        const httpError: KlaviyoHttpError = {
          kind: "http",
          status: response.status,
          klaviyoTitle: first?.title,
          klaviyoDetail: first?.detail,
          klaviyoCode: first?.code,
          ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
        };
        throw httpError;
      }

      if (text.length === 0) {
        return {} as T;
      }
      try {
        return JSON.parse(text) as T;
      } catch {
        throw new ConnectorSdkError(
          "PROVIDER_ERROR",
          "Klaviyo returned invalid JSON.",
        );
      }
    } finally {
      clearTimeout(timeout);
      init.signal?.removeEventListener("abort", onAbort);
    }
  }

  async function requestJson<T>(
    url: string,
    init: {
      readonly method: "GET" | "POST";
      readonly body?: unknown;
      readonly signal?: AbortSignal;
    },
  ): Promise<T> {
    const deadlineMs = Date.now() + requestTimeoutMs;
    let attempt = 0;

    for (;;) {
      if (init.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      const remainingMs = deadlineMs - Date.now();
      if (remainingMs <= 0) {
        throw new Error("Klaviyo request timed out.");
      }

      try {
        return await requestJsonAttempt<T>(url, init, remainingMs);
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
          (error as KlaviyoHttpError).kind === "http"
        ) {
          const httpError = error as KlaviyoHttpError;
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
        await sleepMs(delayMs, init.signal);
      }
    }
  }

  function requestGet<T>(url: string, signal?: AbortSignal): Promise<T> {
    return requestJson(url, { method: "GET", signal });
  }

  function buildReportingUrl(
    path: "/campaign-values-reports/" | "/flow-values-reports/",
    pageCursor?: string,
  ): string {
    const url = new URL(`${apiHost}${path}`);
    const cursor = validatePaginationCursor(pageCursor);
    if (cursor !== undefined) {
      url.searchParams.set("page[cursor]", cursor);
    }
    assertAllowedApiUrl(url.toString(), apiHost);
    return url.toString();
  }

  function requestReportingPost<T>(
    path: "/campaign-values-reports/" | "/flow-values-reports/",
    body: unknown,
    pageCursor: string | undefined,
    signal?: AbortSignal,
  ): Promise<T> {
    const url = buildReportingUrl(path, pageCursor);
    return requestJson(url, { method: "POST", body, signal });
  }

  return {
    getAccounts(params) {
      const url = buildListUrl("/accounts/", 1);
      return requestGet(url, params.signal);
    },

    listCampaigns(params) {
      const url = buildListUrl(
        "/campaigns/",
        params.pageSize,
        params.pageCursor,
      );
      return requestGet(url, params.signal);
    },

    getCampaign(params) {
      const id = assertSafeResourcePathSegment(params.id, "Campaign ID");
      const url = `${apiHost}/campaigns/${encodeURIComponent(id)}/`;
      assertAllowedApiUrl(url, apiHost);
      return requestGet(url, params.signal);
    },

    listFlows(params) {
      const url = buildListUrl("/flows/", params.pageSize, params.pageCursor);
      return requestGet(url, params.signal);
    },

    getFlow(params) {
      const id = assertSafeResourcePathSegment(params.id, "Flow ID");
      const url = `${apiHost}/flows/${encodeURIComponent(id)}/`;
      assertAllowedApiUrl(url, apiHost);
      return requestGet(url, params.signal);
    },

    listMetrics(params) {
      const url = buildListUrl("/metrics/", params.pageSize, params.pageCursor);
      return requestGet(url, params.signal);
    },

    getMetric(params) {
      const id = assertSafeResourcePathSegment(params.id, "Metric ID");
      const url = `${apiHost}/metrics/${encodeURIComponent(id)}/`;
      assertAllowedApiUrl(url, apiHost);
      return requestGet(url, params.signal);
    },

    listEvents(params) {
      if (params.filter.length > MAX_FILTER_STRING_LENGTH) {
        throw new ConnectorSdkError(
          "INVALID_INPUT",
          "Events filter exceeds maximum length.",
        );
      }
      const url = buildListUrl("/events/", params.pageSize, params.pageCursor, {
        filter: params.filter,
        "fields[event]": EVENT_LIST_SPARSE_FIELDS,
      });
      return requestGet(url, params.signal);
    },

    queryCampaignValuesReport(params) {
      const conversionMetricId = assertSafeResourcePathSegment(
        params.conversionMetricId,
        "Conversion metric ID",
      );
      const attributes: Record<string, unknown> = {
        statistics: params.statistics,
        timeframe: params.timeframe,
        conversion_metric_id: conversionMetricId,
      };
      if (params.groupBy !== undefined && params.groupBy.length > 0) {
        attributes.group_by = params.groupBy;
      }
      if (params.filter !== undefined && params.filter.length > 0) {
        if (params.filter.length > MAX_FILTER_STRING_LENGTH) {
          throw new ConnectorSdkError(
            "INVALID_INPUT",
            "Report filter exceeds maximum length.",
          );
        }
        attributes.filter = params.filter;
      }
      const body = {
        data: {
          type: "campaign-values-report",
          attributes,
        },
      };
      return requestReportingPost(
        "/campaign-values-reports/",
        body,
        params.pageCursor,
        params.signal,
      );
    },

    queryFlowValuesReport(params) {
      const conversionMetricId = assertSafeResourcePathSegment(
        params.conversionMetricId,
        "Conversion metric ID",
      );
      const attributes: Record<string, unknown> = {
        statistics: params.statistics,
        timeframe: params.timeframe,
        conversion_metric_id: conversionMetricId,
      };
      if (params.groupBy !== undefined && params.groupBy.length > 0) {
        attributes.group_by = params.groupBy;
      }
      if (params.filter !== undefined && params.filter.length > 0) {
        if (params.filter.length > MAX_FILTER_STRING_LENGTH) {
          throw new ConnectorSdkError(
            "INVALID_INPUT",
            "Report filter exceeds maximum length.",
          );
        }
        attributes.filter = params.filter;
      }
      const body = {
        data: {
          type: "flow-values-report",
          attributes,
        },
      };
      return requestReportingPost(
        "/flow-values-reports/",
        body,
        params.pageCursor,
        params.signal,
      );
    },
  };
}
