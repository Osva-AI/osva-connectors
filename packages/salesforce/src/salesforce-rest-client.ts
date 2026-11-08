import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import {
  MAX_HTTP_REQUEST_BODY_BYTES,
  MAX_HTTP_RESPONSE_BYTES,
  READ_ONLY_MAX_RETRIES,
  READ_ONLY_RETRY_DELAY_MS,
} from "./constants.js";
import { buildSalesforceAuthHeader } from "./salesforce-auth.js";
import type { SalesforceClient } from "./salesforce-client.js";
import {
  decodeContinuationToken,
  encodeContinuationToken,
  fingerprintFilters,
  parseValidatedQueryLocator,
  type QueryFamily,
} from "./query-continuation.js";
import {
  buildAccountListSoql,
  buildContactListSoql,
  buildOpportunityListSoql,
  buildOpportunityStageListSoql,
  normalizeAccountListFilters,
  normalizeContactListFilters,
  normalizeOpportunityListFilters,
} from "./soql-builder.js";

export interface SalesforceHttpError {
  readonly kind: "http";
  readonly status: number;
  readonly retryAfterMs?: number;
}

const SOBJECT_ID_PATTERN = /^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/;
const QUERY_LOCATOR_PATTERN = /^\/query\/[A-Za-z0-9\-]+$/;

function assertSobjectId(id: string, label: string): void {
  if (!SOBJECT_ID_PATTERN.test(id)) {
    throw new ConnectorSdkError("INVALID_INPUT", `${label} is invalid.`);
  }
}

function assertAllowedRelativePath(method: string, pathname: string): void {
  const normalized = pathname.replace(/\/$/, "") || "/";
  if (method === "GET" && normalized === "/query") return;
  if (method === "GET" && QUERY_LOCATOR_PATTERN.test(normalized)) return;
  const sobjectGet =
    method === "GET" &&
    /^\/sobjects\/(Account|Contact|Opportunity)\/[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/.test(
      normalized,
    );
  if (sobjectGet) return;
  const stagePatch =
    method === "PATCH" &&
    /^\/sobjects\/Opportunity\/[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/.test(
      normalized,
    );
  if (stagePatch) return;
  const taskPost = method === "POST" && normalized === "/sobjects/Task";
  if (taskPost) return;
  throw new ConnectorSdkError(
    "PROVIDER_ERROR",
    "Salesforce request path is not supported.",
  );
}

function assertAllowedApiUrl(
  pinnedOrigin: string,
  apiDataBaseUrl: string,
  url: string,
): void {
  const parsed = new URL(url);
  if (parsed.origin !== pinnedOrigin) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Salesforce request URL is not allowed.",
    );
  }
  const basePath = new URL(apiDataBaseUrl).pathname.replace(/\/$/, "");
  if (!parsed.pathname.startsWith(basePath)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Salesforce request URL is not allowed.",
    );
  }
}

async function readBoundedResponseText(
  response: Response,
  maxBytes: number,
  signal: AbortSignal | undefined,
): Promise<string> {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const lengthHeader = response.headers.get("content-length");
  if (lengthHeader !== null) {
    const declared = Number(lengthHeader);
    if (Number.isFinite(declared) && declared > maxBytes) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Salesforce response exceeds the connector size limit.",
      );
    }
  }
  if (response.body === null) return "";
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
        "Salesforce response exceeds the connector size limit.",
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

function parseRetryAfterMs(response: Response): number | undefined {
  const header = response.headers.get("retry-after");
  if (header === null) return undefined;
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1_000 : undefined;
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

export interface CreateSalesforceRestClientOptions {
  readonly apiDataBaseUrl: string;
  readonly pinnedOrigin: string;
  readonly accessToken: string;
  readonly requestTimeoutMs: number;
  readonly fetchImpl?: typeof fetch;
}

export function createSalesforceRestClient(
  options: CreateSalesforceRestClientOptions,
): SalesforceClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.apiDataBaseUrl.replace(/\/$/, "");
  const basePath = new URL(baseUrl).pathname.replace(/\/$/, "");
  const authHeader = buildSalesforceAuthHeader(options.accessToken);
  const apiVersionPath = basePath;

  async function requestJson(
    method: string,
    relativePath: string,
    signal: AbortSignal | undefined,
    body?: Record<string, unknown>,
    query?: URLSearchParams,
  ): Promise<unknown> {
    const pathOnly = relativePath.split("?")[0] ?? relativePath;
    const relative = pathOnly.startsWith(basePath)
      ? pathOnly.slice(basePath.length) || "/"
      : pathOnly.startsWith("/")
        ? pathOnly
        : `/${pathOnly}`;
    assertAllowedRelativePath(method, relative);
    const suffix = query !== undefined ? `?${query.toString()}` : "";
    const url = `${baseUrl}${relative.startsWith("/") ? relative : `/${relative}`}${suffix}`;
    assertAllowedApiUrl(
      options.pinnedOrigin,
      baseUrl,
      url.split("?")[0] ?? url,
    );
    let bodyText: string | undefined;
    if (body !== undefined) {
      bodyText = JSON.stringify(body);
      if (Buffer.byteLength(bodyText, "utf8") > MAX_HTTP_REQUEST_BODY_BYTES) {
        throw new ConnectorSdkError(
          "INVALID_INPUT",
          "Salesforce update payload exceeds the size limit.",
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
            "Salesforce redirects are not followed.",
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
              "Salesforce returned invalid JSON.",
            );
          }
        }
        const httpError: SalesforceHttpError = {
          kind: "http",
          status: response.status,
          ...(parseRetryAfterMs(response) !== undefined
            ? { retryAfterMs: parseRetryAfterMs(response) }
            : {}),
        };
        const retriable =
          method === "GET" &&
          attempt < READ_ONLY_MAX_RETRIES &&
          [429, 502, 503, 504].includes(response.status);
        if (retriable) {
          attempt += 1;
          await sleep(
            httpError.retryAfterMs ?? READ_ONLY_RETRY_DELAY_MS,
            signal,
          );
          continue;
        }
        throw httpError;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          if (signal?.aborted) throw error;
          throw new ConnectorSdkError(
            "TIMEOUT",
            "Salesforce request timed out.",
          );
        }
        throw error;
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
      }
    }
  }

  async function runQuery(
    soql: string,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const query = new URLSearchParams();
    query.set("q", soql);
    return requestJson("GET", "/query", signal, undefined, query);
  }

  async function runQueryLocator(
    locatorSuffix: string,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const path = locatorSuffix.startsWith("/")
      ? locatorSuffix
      : `/${locatorSuffix}`;
    if (!QUERY_LOCATOR_PATTERN.test(path)) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Salesforce query locator is invalid.",
      );
    }
    return requestJson("GET", path, signal);
  }

  function attachContinuationFromResponse(
    raw: unknown,
    family: QueryFamily,
    filterFingerprint: string,
  ): { raw: unknown; continuationToken?: string } {
    if (typeof raw !== "object" || raw === null) {
      return { raw };
    }
    const record = raw as Record<string, unknown>;
    const done = record.done;
    const next =
      typeof record.nextRecordsUrl === "string"
        ? record.nextRecordsUrl
        : undefined;
    if (done !== false || next === undefined) {
      return { raw };
    }
    const locatorSuffix = parseValidatedQueryLocator(
      next,
      options.pinnedOrigin,
      baseUrl,
      apiVersionPath,
    );
    const continuationToken = encodeContinuationToken({
      v: 1,
      family,
      filterFingerprint,
      locatorSuffix,
    });
    return { raw, continuationToken };
  }

  async function listWithContinuation(
    family: QueryFamily,
    params: {
      readonly perPage: number;
      readonly continuationToken?: string;
      readonly filters?: Record<string, string | undefined>;
    },
    buildSoql: (limit: number) => string,
    signal?: AbortSignal,
  ): Promise<{ raw: unknown; continuationToken?: string }> {
    const filterFingerprint = fingerprintFilters(params.filters ?? {});
    if (params.continuationToken !== undefined) {
      const payload = decodeContinuationToken(params.continuationToken);
      if (payload.family !== family) {
        throw new ConnectorSdkError(
          "INVALID_INPUT",
          "Continuation token does not match this list tool.",
        );
      }
      const raw = await runQueryLocator(payload.locatorSuffix, signal);
      return attachContinuationFromResponse(
        raw,
        family,
        payload.filterFingerprint,
      );
    }
    const raw = await runQuery(buildSoql(params.perPage), signal);
    return attachContinuationFromResponse(raw, family, filterFingerprint);
  }

  return {
    listAccounts: async (params, signal) => {
      const filters = normalizeAccountListFilters(params.filters);
      const { raw, continuationToken } = await listWithContinuation(
        "account",
        {
          perPage: params.perPage,
          continuationToken: params.continuationToken,
          filters,
        },
        (limit) => buildAccountListSoql(limit, params.filters),
        signal,
      );
      return continuationToken !== undefined
        ? { ...(raw as object), __continuationToken: continuationToken }
        : raw;
    },
    getAccount: (accountId, signal) => {
      assertSobjectId(accountId, "Account id");
      return requestJson("GET", `/sobjects/Account/${accountId}`, signal);
    },
    listContacts: async (params, signal) => {
      const filters = normalizeContactListFilters(params.filters);
      const { raw, continuationToken } = await listWithContinuation(
        "contact",
        {
          perPage: params.perPage,
          continuationToken: params.continuationToken,
          filters,
        },
        (limit) => buildContactListSoql(limit, params.filters),
        signal,
      );
      return continuationToken !== undefined
        ? { ...(raw as object), __continuationToken: continuationToken }
        : raw;
    },
    getContact: (contactId, signal) => {
      assertSobjectId(contactId, "Contact id");
      return requestJson("GET", `/sobjects/Contact/${contactId}`, signal);
    },
    listOpportunities: async (params, signal) => {
      const filters = normalizeOpportunityListFilters(params.filters);
      const { raw, continuationToken } = await listWithContinuation(
        "opportunity",
        {
          perPage: params.perPage,
          continuationToken: params.continuationToken,
          filters,
        },
        (limit) => buildOpportunityListSoql(limit, params.filters),
        signal,
      );
      return continuationToken !== undefined
        ? { ...(raw as object), __continuationToken: continuationToken }
        : raw;
    },
    getOpportunity: (opportunityId, signal) => {
      assertSobjectId(opportunityId, "Opportunity id");
      return requestJson(
        "GET",
        `/sobjects/Opportunity/${opportunityId}`,
        signal,
      );
    },
    listOpportunityStages: (signal) =>
      runQuery(buildOpportunityStageListSoql(), signal),
    setOpportunityStage: (opportunityId, body, signal) => {
      assertSobjectId(opportunityId, "Opportunity id");
      return requestJson(
        "PATCH",
        `/sobjects/Opportunity/${opportunityId}`,
        signal,
        body,
      );
    },
    createTask: (body, signal) =>
      requestJson("POST", "/sobjects/Task", signal, body),
  };
}
