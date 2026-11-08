import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { assertAllowedAmplitudeUrl } from "./amplitude-host.js";
import type { AmplitudeClient } from "./amplitude-client.js";
import { parseChartId } from "./chart-id.js";
import {
  AMPLITUDE_API_HOST_US,
  MAX_FUNNEL_EVENTS,
  MAX_GROUP_BY_PROPERTIES,
  MAX_HTTP_RESPONSE_BYTES,
  MAX_SEGMENT_PARAM_LENGTH,
  READ_ONLY_MAX_RETRIES,
  READ_ONLY_RETRY_DELAY_MS,
} from "./constants.js";
import {
  encodeEventJsonArrayForQuery,
  encodeEventJsonForQuery,
} from "./encode-event-json.js";

export interface AmplitudeHttpError {
  readonly kind: "http";
  readonly status: number;
  readonly amplitudeMessage?: string;
  readonly retryAfterMs?: number;
}

export interface CreateAmplitudeRestClientOptions {
  readonly apiKey: string;
  readonly secretKey: string;
  readonly requestTimeoutMs: number;
  readonly apiHost?: string;
  readonly fetchImpl?: typeof fetch;
}

interface AmplitudeErrorBody {
  readonly error?: string;
  readonly message?: string;
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
        "Amplitude response exceeds the connector size limit.",
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
        "Amplitude response exceeds the connector size limit.",
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

function parseAmplitudeErrorBody(text: string): AmplitudeErrorBody | undefined {
  try {
    return JSON.parse(text) as AmplitudeErrorBody;
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
    (error as AmplitudeHttpError).kind === "http"
  ) {
    const status = (error as AmplitudeHttpError).status;
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

function basicAuthorization(apiKey: string, secretKey: string): string {
  const credentials = `${apiKey}:${secretKey}`;
  return `Basic ${Buffer.from(credentials, "utf8").toString("base64")}`;
}

function appendGroupBy(
  url: URL,
  groupBy: readonly string[] | string | undefined,
  maxCount: number,
): void {
  if (groupBy === undefined) {
    return;
  }
  const values = Array.isArray(groupBy) ? groupBy : [groupBy];
  if (values.length > maxCount) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      `At most ${maxCount} group-by properties are supported.`,
    );
  }
  for (const property of values) {
    const trimmed = property.trim();
    if (trimmed.length === 0) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Group-by property names must be non-empty.",
      );
    }
    url.searchParams.append("g", trimmed);
  }
}

function appendOptionalSegment(url: URL, segment: string | undefined): void {
  if (segment === undefined) {
    return;
  }
  const trimmed = segment.trim();
  if (trimmed.length === 0) {
    return;
  }
  if (trimmed.length > MAX_SEGMENT_PARAM_LENGTH) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Segment parameter exceeds maximum length.",
    );
  }
  url.searchParams.set("s", trimmed);
}

export function createAmplitudeRestClient(
  options: CreateAmplitudeRestClientOptions,
): AmplitudeClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiHost = (options.apiHost ?? AMPLITUDE_API_HOST_US).replace(/\/$/, "");
  const requestTimeoutMs = options.requestTimeoutMs;
  const apiKey = options.apiKey.trim();
  const secretKey = options.secretKey.trim();
  const authorization = basicAuthorization(apiKey, secretKey);

  async function requestJsonAttempt<T>(
    url: string,
    signal: AbortSignal | undefined,
    attemptTimeoutMs: number,
  ): Promise<T> {
    assertAllowedAmplitudeUrl(url, apiHost);

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort(new Error("Amplitude request timed out."));
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
          Authorization: authorization,
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      const text = await readBoundedResponseText(
        response,
        MAX_HTTP_RESPONSE_BYTES,
        controller.signal,
      );

      if (!response.ok) {
        const amplitudeBody = parseAmplitudeErrorBody(text);
        const retryAfterMs = parseRetryAfterMs(response);
        const httpError: AmplitudeHttpError = {
          kind: "http",
          status: response.status,
          amplitudeMessage: amplitudeBody?.error ?? amplitudeBody?.message,
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
          "Amplitude returned invalid JSON.",
        );
      }
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
    }
  }

  async function requestJson<T>(url: string, signal?: AbortSignal): Promise<T> {
    const deadlineMs = Date.now() + requestTimeoutMs;
    let attempt = 0;

    for (;;) {
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      const remainingMs = deadlineMs - Date.now();
      if (remainingMs <= 0) {
        throw new Error("Amplitude request timed out.");
      }

      try {
        return await requestJsonAttempt<T>(url, signal, remainingMs);
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
          (error as AmplitudeHttpError).kind === "http"
        ) {
          const httpError = error as AmplitudeHttpError;
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

  function buildUrl(path: string, mutate: (url: URL) => void): string {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(`${apiHost}${normalizedPath}`);
    mutate(url);
    const finalUrl = url.toString();
    assertAllowedAmplitudeUrl(finalUrl, apiHost);
    return finalUrl;
  }

  return {
    listEventTypes(params) {
      const url = buildUrl("/api/2/events/list", () => {});
      return requestJson(url, params.signal);
    },

    queryEventSegmentation(params) {
      const url = buildUrl("/api/2/events/segmentation", (url) => {
        url.searchParams.set(
          "e",
          encodeEventJsonForQuery(params.event, "Primary event"),
        );
        if (params.secondEvent !== undefined) {
          url.searchParams.set(
            "e2",
            encodeEventJsonForQuery(params.secondEvent, "Secondary event"),
          );
        }
        url.searchParams.set("start", params.start);
        url.searchParams.set("end", params.end);
        if (params.metric !== undefined) {
          url.searchParams.set("m", params.metric);
        }
        if (params.interval !== undefined) {
          url.searchParams.set("i", String(params.interval));
        }
        if (params.limit !== undefined) {
          url.searchParams.set("limit", String(params.limit));
        }
        appendGroupBy(url, params.groupBy, MAX_GROUP_BY_PROPERTIES);
        appendOptionalSegment(url, params.segment);
      });
      return requestJson(url, params.signal);
    },

    queryFunnel(params) {
      const encodedEvents = encodeEventJsonArrayForQuery(
        params.events,
        "Funnel step",
        MAX_FUNNEL_EVENTS,
      );
      const url = buildUrl("/api/2/funnels", (url) => {
        for (const eventJson of encodedEvents) {
          url.searchParams.append("e", eventJson);
        }
        url.searchParams.set("start", params.start);
        url.searchParams.set("end", params.end);
        if (params.mode !== undefined) {
          url.searchParams.set("mode", params.mode);
        }
        if (params.userType !== undefined) {
          url.searchParams.set("n", params.userType);
        }
        if (params.interval !== undefined) {
          url.searchParams.set("i", String(params.interval));
        }
        if (params.groupBy !== undefined) {
          appendGroupBy(url, params.groupBy, 1);
        }
        appendOptionalSegment(url, params.segment);
      });
      return requestJson(url, params.signal);
    },

    queryRetention(params) {
      const url = buildUrl("/api/2/retention", (url) => {
        url.searchParams.set(
          "se",
          encodeEventJsonForQuery(params.startEvent, "Start event"),
        );
        url.searchParams.set(
          "re",
          encodeEventJsonForQuery(params.returnEvent, "Return event"),
        );
        url.searchParams.set("start", params.start);
        url.searchParams.set("end", params.end);
        if (params.retentionMode !== undefined) {
          url.searchParams.set("rm", params.retentionMode);
        }
        if (params.interval !== undefined) {
          url.searchParams.set("i", String(params.interval));
        }
        if (params.groupBy !== undefined) {
          appendGroupBy(url, params.groupBy, 1);
        }
        appendOptionalSegment(url, params.segment);
      });
      return requestJson(url, params.signal);
    },

    queryActiveUsers(params) {
      const url = buildUrl("/api/2/users", (url) => {
        url.searchParams.set("start", params.start);
        url.searchParams.set("end", params.end);
        if (params.userMetric !== undefined) {
          url.searchParams.set("m", params.userMetric);
        }
        if (params.interval !== undefined) {
          url.searchParams.set("i", String(params.interval));
        }
        if (params.groupBy !== undefined) {
          appendGroupBy(url, params.groupBy, 1);
        }
        appendOptionalSegment(url, params.segment);
      });
      return requestJson(url, params.signal);
    },

    queryChart(params) {
      const chartId = parseChartId(params.chartId);
      const url = buildUrl(
        `/api/3/chart/${encodeURIComponent(chartId)}/query`,
        () => {},
      );
      return requestJson(url, params.signal);
    },

    queryAverageSessionLength(params) {
      const url = buildUrl("/api/2/sessions/average", (url) => {
        url.searchParams.set("start", params.start);
        url.searchParams.set("end", params.end);
      });
      return requestJson(url, params.signal);
    },
  };
}
