import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { encodeA1RangeForPath } from "./a1-range.js";
import {
  MAX_HTTP_RESPONSE_BYTES,
  READ_ONLY_MAX_RETRIES,
  READ_ONLY_RETRY_DELAY_MS,
  SHEETS_API_HOST,
} from "./constants.js";
import type { SheetsTokenProvider } from "./sheets-auth.js";
import type { SheetsClient } from "./sheets-client.js";

export interface SheetsHttpError {
  readonly kind: "http";
  readonly status: number;
  readonly googleStatus?: string;
  readonly googleMessage?: string;
  readonly retryAfterMs?: number;
}

interface GoogleErrorBody {
  readonly error?: {
    readonly code?: number;
    readonly message?: string;
    readonly status?: string;
  };
}

export interface CreateSheetsRestClientOptions {
  readonly tokenProvider: SheetsTokenProvider;
  readonly requestTimeoutMs: number;
  readonly sheetsApiHost?: string;
  readonly fetchImpl?: typeof fetch;
}

const PRODUCTION_HOSTNAME = "sheets.googleapis.com";

const SPREADSHEET_GET_FIELDS =
  "spreadsheetId,properties(title,locale,timeZone),sheets(properties(sheetId,title,index,sheetType,gridProperties(rowCount,columnCount)))";

function assertAllowedApiUrl(url: string, sheetsApiHost: string): void {
  if (!url.startsWith(`${sheetsApiHost}/`)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Google Sheets request URL is not allowed.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Google Sheets request URL is invalid.",
    );
  }

  if (sheetsApiHost === SHEETS_API_HOST) {
    if (parsed.protocol !== "https:") {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Google Sheets request URL is not allowed.",
      );
    }
    if (parsed.hostname !== PRODUCTION_HOSTNAME) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Google Sheets request URL is not allowed.",
      );
    }
    if (!parsed.pathname.startsWith("/v4/spreadsheets")) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Google Sheets request URL is not allowed.",
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
      "Google Sheets request URL is not allowed.",
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
        "Google Sheets response exceeds the connector size limit.",
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
        "Google Sheets response exceeds the connector size limit.",
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

function parseGoogleErrorBody(text: string): GoogleErrorBody | undefined {
  try {
    return JSON.parse(text) as GoogleErrorBody;
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
    (error as SheetsHttpError).kind === "http"
  ) {
    const status = (error as SheetsHttpError).status;
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

export function createSheetsRestClient(
  options: CreateSheetsRestClientOptions,
): SheetsClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sheetsApiHost = options.sheetsApiHost ?? SHEETS_API_HOST;
  const requestTimeoutMs = options.requestTimeoutMs;

  function throwHttpError(response: Response, bodyText: string): never {
    const googleBody = parseGoogleErrorBody(bodyText);
    const retryAfterMs = parseRetryAfterMs(response);
    const httpError: SheetsHttpError = {
      kind: "http",
      status: response.status,
      googleStatus: googleBody?.error?.status,
      googleMessage: googleBody?.error?.message,
      ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
    };
    throw httpError;
  }

  async function requestAttempt(
    url: string,
    init: {
      readonly method: "GET" | "POST" | "PUT";
      readonly signal?: AbortSignal;
      readonly body?: string;
    },
    attemptTimeoutMs: number,
  ): Promise<string> {
    assertAllowedApiUrl(url, sheetsApiHost);

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort(new Error("Google Sheets request timed out."));
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
      const authorization = await options.tokenProvider.getAuthorizationHeader({
        signal: init.signal,
        deadlineMs: attemptTimeoutMs,
      });

      const headers: Record<string, string> = {
        Authorization: authorization,
        Accept: "application/json",
      };
      if (init.body !== undefined) {
        headers["Content-Type"] = "application/json";
      }

      const response = await fetchImpl(url, {
        method: init.method,
        headers,
        ...(init.body !== undefined ? { body: init.body } : {}),
        signal: controller.signal,
      });

      const bodyText = await readBoundedResponseText(
        response,
        MAX_HTTP_RESPONSE_BYTES,
        controller.signal,
      );

      if (!response.ok) {
        throwHttpError(response, bodyText);
      }

      return bodyText;
    } finally {
      clearTimeout(timeout);
      init.signal?.removeEventListener("abort", onAbort);
    }
  }

  async function requestWithRetry(
    url: string,
    init: {
      readonly method: "GET";
      readonly signal?: AbortSignal;
    },
  ): Promise<string> {
    const deadlineMs = Date.now() + requestTimeoutMs;
    let attempt = 0;

    for (;;) {
      if (init.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      const remainingMs = deadlineMs - Date.now();
      if (remainingMs <= 0) {
        throw new Error("Google Sheets request timed out.");
      }

      try {
        return await requestAttempt(url, init, remainingMs);
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
          (error as SheetsHttpError).kind === "http"
        ) {
          const httpError = error as SheetsHttpError;
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

  async function requestMutation(
    url: string,
    init: {
      readonly method: "POST" | "PUT";
      readonly signal?: AbortSignal;
      readonly body: string;
    },
  ): Promise<string> {
    const deadlineMs = Date.now() + requestTimeoutMs;
    const remainingMs = deadlineMs - Date.now();
    if (remainingMs <= 0) {
      throw new Error("Google Sheets request timed out.");
    }
    return requestAttempt(
      url,
      {
        method: init.method,
        signal: init.signal,
        body: init.body,
      },
      remainingMs,
    );
  }

  function parseJson(bodyText: string): unknown {
    try {
      return JSON.parse(bodyText) as unknown;
    } catch {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Google Sheets returned invalid JSON.",
      );
    }
  }

  return {
    async getSpreadsheet(params) {
      const url = `${sheetsApiHost}/spreadsheets/${encodeURIComponent(params.spreadsheetId)}?fields=${encodeURIComponent(SPREADSHEET_GET_FIELDS)}`;
      const bodyText = await requestWithRetry(url, {
        method: "GET",
        signal: params.signal,
      });
      return parseJson(bodyText);
    },

    async listSheets(params) {
      const url = `${sheetsApiHost}/spreadsheets/${encodeURIComponent(params.spreadsheetId)}?fields=${encodeURIComponent("spreadsheetId,sheets(properties(sheetId,title,index,sheetType,hidden,gridProperties(rowCount,columnCount)))")}`;
      const bodyText = await requestWithRetry(url, {
        method: "GET",
        signal: params.signal,
      });
      return parseJson(bodyText);
    },

    async getValues(params) {
      const rangePath = encodeA1RangeForPath(params.range);
      const search = new URLSearchParams();
      if (params.valueRenderOption !== undefined) {
        search.set("valueRenderOption", params.valueRenderOption);
      }
      const query = search.toString();
      const url = `${sheetsApiHost}/spreadsheets/${encodeURIComponent(params.spreadsheetId)}/values/${rangePath}${query.length > 0 ? `?${query}` : ""}`;
      const bodyText = await requestWithRetry(url, {
        method: "GET",
        signal: params.signal,
      });
      return parseJson(bodyText);
    },

    async batchGetValues(params) {
      const search = new URLSearchParams();
      for (const range of params.ranges) {
        search.append("ranges", range.trim());
      }
      search.set("majorDimension", "ROWS");
      if (params.valueRenderOption !== undefined) {
        search.set("valueRenderOption", params.valueRenderOption);
      }
      const url = `${sheetsApiHost}/spreadsheets/${encodeURIComponent(params.spreadsheetId)}/values:batchGet?${search.toString()}`;
      const bodyText = await requestWithRetry(url, {
        method: "GET",
        signal: params.signal,
      });
      return parseJson(bodyText);
    },

    async appendValues(params) {
      const rangePath = encodeA1RangeForPath(params.range);
      const url = `${sheetsApiHost}/spreadsheets/${encodeURIComponent(params.spreadsheetId)}/values/${rangePath}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
      const bodyText = await requestMutation(url, {
        method: "POST",
        signal: params.signal,
        body: JSON.stringify({
          majorDimension: "ROWS",
          values: params.values,
        }),
      });
      return parseJson(bodyText);
    },

    async updateValues(params) {
      const rangePath = encodeA1RangeForPath(params.range);
      const url = `${sheetsApiHost}/spreadsheets/${encodeURIComponent(params.spreadsheetId)}/values/${rangePath}?valueInputOption=RAW`;
      const bodyText = await requestMutation(url, {
        method: "PUT",
        signal: params.signal,
        body: JSON.stringify({
          majorDimension: "ROWS",
          values: params.values,
        }),
      });
      return parseJson(bodyText);
    },

    async batchUpdateValues(params) {
      const url = `${sheetsApiHost}/spreadsheets/${encodeURIComponent(params.spreadsheetId)}/values:batchUpdate`;
      const bodyText = await requestMutation(url, {
        method: "POST",
        signal: params.signal,
        body: JSON.stringify({
          valueInputOption: "RAW",
          data: params.data.map((entry) => ({
            range: entry.range.trim(),
            majorDimension: "ROWS",
            values: entry.values,
          })),
        }),
      });
      return parseJson(bodyText);
    },

    async addSheet(params) {
      const url = `${sheetsApiHost}/spreadsheets/${encodeURIComponent(params.spreadsheetId)}:batchUpdate`;
      const bodyText = await requestMutation(url, {
        method: "POST",
        signal: params.signal,
        body: JSON.stringify({
          requests: [
            {
              addSheet: {
                properties: {
                  title: params.title,
                  ...(params.rowCount !== undefined ||
                  params.columnCount !== undefined
                    ? {
                        gridProperties: {
                          ...(params.rowCount !== undefined
                            ? { rowCount: params.rowCount }
                            : {}),
                          ...(params.columnCount !== undefined
                            ? { columnCount: params.columnCount }
                            : {}),
                        },
                      }
                    : {}),
                },
              },
            },
          ],
        }),
      });
      return parseJson(bodyText);
    },
  };
}
