import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import {
  MAX_HTTP_REQUEST_BODY_BYTES,
  MAX_HTTP_RESPONSE_BYTES,
  READ_ONLY_MAX_RETRIES,
  READ_ONLY_RETRY_DELAY_MS,
} from "./constants.js";
import { buildZohoAuthHeader } from "./zoho-auth.js";
import type { ZohoClient } from "./zoho-client.js";

export interface ZohoHttpError {
  readonly kind: "http";
  readonly status: number;
  readonly retryAfterMs?: number;
}

const PATH_PATTERNS = [
  { method: "GET", pattern: /^\/Leads$/ },
  { method: "GET", pattern: /^\/Leads\/[^/]+$/ },
  { method: "GET", pattern: /^\/Accounts$/ },
  { method: "GET", pattern: /^\/Accounts\/[^/]+$/ },
  { method: "GET", pattern: /^\/Contacts$/ },
  { method: "GET", pattern: /^\/Contacts\/[^/]+$/ },
  { method: "GET", pattern: /^\/Deals$/ },
  { method: "GET", pattern: /^\/Deals\/[^/]+$/ },
  { method: "GET", pattern: /^\/settings\/fields$/ },
  { method: "PUT", pattern: /^\/Deals\/[^/]+$/ },
  { method: "POST", pattern: /^\/Deals\/[^/]+\/Notes$/ },
];

function assertAllowedRelativePath(method: string, pathname: string): void {
  const normalized = pathname.replace(/\/$/, "") || "/";
  if (
    !PATH_PATTERNS.some(
      (entry) => entry.method === method && entry.pattern.test(normalized),
    )
  ) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Zoho CRM request path is not supported.",
    );
  }
}

function assertAllowedApiUrl(
  pinnedOrigin: string,
  apiBaseUrl: string,
  url: string,
): void {
  const parsed = new URL(url);
  if (parsed.origin !== pinnedOrigin) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Zoho CRM request URL is not allowed.",
    );
  }
  const basePath = new URL(apiBaseUrl).pathname.replace(/\/$/, "");
  if (basePath.length > 0 && !parsed.pathname.startsWith(basePath)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Zoho CRM request URL is not allowed.",
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
        "Zoho CRM response exceeds the connector size limit.",
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
        "Zoho CRM response exceeds the connector size limit.",
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

export interface CreateZohoRestClientOptions {
  readonly apiBaseUrl: string;
  readonly pinnedOrigin: string;
  readonly accessToken: string;
  readonly requestTimeoutMs: number;
  readonly fetchImpl?: typeof fetch;
}

export function createZohoRestClient(
  options: CreateZohoRestClientOptions,
): ZohoClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.apiBaseUrl.replace(/\/$/, "");
  const basePath = new URL(baseUrl).pathname.replace(/\/$/, "");
  const authHeader = buildZohoAuthHeader(options.accessToken);

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
          "Zoho CRM update payload exceeds the size limit.",
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
            "Zoho CRM redirects are not followed.",
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
              "Zoho CRM returned invalid JSON.",
            );
          }
        }
        const httpError: ZohoHttpError = {
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
          throw new ConnectorSdkError("TIMEOUT", "Zoho CRM request timed out.");
        }
        throw error;
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
      }
    }
  }

  function listQuery(params: { page: number; perPage: number }) {
    const query = new URLSearchParams();
    query.set("page", String(params.page));
    query.set("per_page", String(params.perPage));
    return query;
  }

  return {
    listLeads: (params, signal) =>
      requestJson("GET", "/Leads", signal, undefined, listQuery(params)),
    getLead: (leadId, signal) =>
      requestJson("GET", `/Leads/${encodeURIComponent(leadId)}`, signal),
    listAccounts: (params, signal) =>
      requestJson("GET", "/Accounts", signal, undefined, listQuery(params)),
    getAccount: (accountId, signal) =>
      requestJson("GET", `/Accounts/${encodeURIComponent(accountId)}`, signal),
    listContacts: (params, signal) =>
      requestJson("GET", "/Contacts", signal, undefined, listQuery(params)),
    getContact: (contactId, signal) =>
      requestJson("GET", `/Contacts/${encodeURIComponent(contactId)}`, signal),
    listDeals: (params, signal) =>
      requestJson("GET", "/Deals", signal, undefined, listQuery(params)),
    getDeal: (dealId, signal) =>
      requestJson("GET", `/Deals/${encodeURIComponent(dealId)}`, signal),
    listDealStageFields: (signal) => {
      const query = new URLSearchParams();
      query.set("module", "Deals");
      return requestJson("GET", "/settings/fields", signal, undefined, query);
    },
    setDealStage: (dealId, body, signal) =>
      requestJson("PUT", `/Deals/${encodeURIComponent(dealId)}`, signal, body),
    addDealNote: (dealId, body, signal) =>
      requestJson(
        "POST",
        `/Deals/${encodeURIComponent(dealId)}/Notes`,
        signal,
        body,
      ),
  };
}
