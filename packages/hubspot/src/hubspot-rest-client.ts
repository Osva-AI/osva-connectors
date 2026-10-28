import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  HUBSPOT_API_HOST,
  HUBSPOT_API_VERSION,
  MAX_HTTP_RESPONSE_BYTES,
  READ_ONLY_MAX_RETRIES,
  READ_ONLY_RETRY_DELAY_MS,
} from "./constants.js";
import type { HubspotClient } from "./hubspot-client.js";
import { validatePaginationCursor } from "./pagination.js";
import type { CrmObjectType } from "./property-allowlist.js";
import { parseHubspotResourceId } from "./resource-id.js";

export interface HubspotHttpError {
  readonly kind: "http";
  readonly status: number;
  readonly hubspotMessage?: string;
  readonly hubspotCategory?: string;
  readonly retryAfterMs?: number;
}

interface HubspotErrorBody {
  readonly status?: string;
  readonly message?: string;
  readonly category?: string;
}

export interface CreateHubspotRestClientOptions {
  readonly accessToken: string;
  readonly requestTimeoutMs: number;
  readonly apiHost?: string;
  readonly apiVersion?: string;
  readonly fetchImpl?: typeof fetch;
}

const PRODUCTION_HOSTNAME = "api.hubapi.com";

function assertAllowedApiUrl(url: string, apiHost: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "HubSpot request URL is invalid.",
    );
  }

  const onApi =
    url === apiHost ||
    url.startsWith(`${apiHost}/`) ||
    url.startsWith(`${apiHost.replace(/\/$/, "")}/`);
  if (!onApi) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "HubSpot request URL is not allowed.",
    );
  }

  if (apiHost === HUBSPOT_API_HOST) {
    if (parsed.protocol !== "https:") {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "HubSpot request URL is not allowed.",
      );
    }
    if (parsed.hostname !== PRODUCTION_HOSTNAME) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "HubSpot request URL is not allowed.",
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
      "HubSpot request URL is not allowed.",
    );
  }
}

function assertSafeObjectType(objectType: CrmObjectType): CrmObjectType {
  if (
    objectType !== "contacts" &&
    objectType !== "companies" &&
    objectType !== "deals"
  ) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "CRM object type is not supported.",
    );
  }
  return objectType;
}

function assertSafeResourcePathSegment(segment: string, label: string): string {
  return parseHubspotResourceId(segment, label);
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
        "HubSpot response exceeds the connector size limit.",
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
        "HubSpot response exceeds the connector size limit.",
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

function parseHubspotErrorBody(text: string): HubspotErrorBody | undefined {
  try {
    return JSON.parse(text) as HubspotErrorBody;
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
    (error as HubspotHttpError).kind === "http"
  ) {
    const status = (error as HubspotHttpError).status;
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

export function createHubspotRestClient(
  options: CreateHubspotRestClientOptions,
): HubspotClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiHost = (options.apiHost ?? HUBSPOT_API_HOST).replace(/\/$/, "");
  const apiVersion = options.apiVersion ?? HUBSPOT_API_VERSION;
  const requestTimeoutMs = options.requestTimeoutMs;
  const accessToken = options.accessToken.trim();

  function crmObjectsBase(objectType: CrmObjectType): string {
    const type = assertSafeObjectType(objectType);
    return `${apiHost}/crm/objects/${apiVersion}/${type}`;
  }

  function buildListUrl(
    basePath: string,
    pageSize: number,
    properties: readonly string[],
    pageCursor?: string,
  ): string {
    const url = new URL(basePath);
    url.searchParams.set("limit", String(pageSize));
    if (properties.length > 0) {
      url.searchParams.set("properties", properties.join(","));
    }
    const cursor = validatePaginationCursor(pageCursor);
    if (cursor !== undefined) {
      url.searchParams.set("after", cursor);
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
      controller.abort(new Error("HubSpot request timed out."));
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
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        signal: controller.signal,
      });

      const text = await readBoundedResponseText(
        response,
        MAX_HTTP_RESPONSE_BYTES,
        controller.signal,
      );

      if (!response.ok) {
        const hubspotBody = parseHubspotErrorBody(text);
        const retryAfterMs = parseRetryAfterMs(response);
        const httpError: HubspotHttpError = {
          kind: "http",
          status: response.status,
          hubspotMessage: hubspotBody?.message,
          hubspotCategory: hubspotBody?.category,
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
          "HubSpot returned invalid JSON.",
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
        throw new Error("HubSpot request timed out.");
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
          (error as HubspotHttpError).kind === "http"
        ) {
          const httpError = error as HubspotHttpError;
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

  function requestSearchPost<T>(
    objectType: CrmObjectType,
    body: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<T> {
    const url = `${crmObjectsBase(objectType)}/search`;
    assertAllowedApiUrl(url, apiHost);
    return requestJson(url, { method: "POST", body, signal });
  }

  return {
    listCrmObjects(objectType, params) {
      const url = buildListUrl(
        crmObjectsBase(objectType),
        params.pageSize,
        params.properties,
        params.pageCursor,
      );
      return requestGet(url, params.signal);
    },

    getCrmObject(objectType, params) {
      const id = assertSafeResourcePathSegment(params.id, "Object ID");
      const url = new URL(
        `${crmObjectsBase(objectType)}/${encodeURIComponent(id)}`,
      );
      if (params.properties.length > 0) {
        url.searchParams.set("properties", params.properties.join(","));
      }
      assertAllowedApiUrl(url.toString(), apiHost);
      return requestGet(url.toString(), params.signal);
    },

    searchCrmObjects(params) {
      return requestSearchPost(params.objectType, params.body, params.signal);
    },

    listDealPipelines(params) {
      const url = `${apiHost}/crm/pipelines/${apiVersion}/deals`;
      assertAllowedApiUrl(url, apiHost);
      return requestGet(url, params.signal);
    },

    listOwners(params) {
      const url = buildListUrl(
        `${apiHost}/crm/owners/${apiVersion}`,
        params.pageSize,
        [],
        params.pageCursor,
      );
      return requestGet(url, params.signal);
    },

    listAssociations(params) {
      const fromType = assertSafeObjectType(params.fromObjectType);
      const toType = assertSafeObjectType(params.toObjectType);
      const fromId = assertSafeResourcePathSegment(
        params.fromObjectId,
        "From object ID",
      );
      const base = `${apiHost}/crm/objects/${apiVersion}/${fromType}/${encodeURIComponent(fromId)}/associations/${toType}`;
      const url = buildListUrl(base, params.pageSize, [], params.pageCursor);
      return requestGet(url, params.signal);
    },
  };
}
