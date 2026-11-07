import { ConnectorSdkError, rateLimitError } from "@osva-ai/connector-sdk";

import type { TavilyHttpError } from "./tavily-rest-client.js";

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }
  if (error instanceof Error && error.name === "AbortError") {
    return true;
  }
  return false;
}

function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const code = (error as Error & { code?: string }).code;
  return (
    error.name === "TimeoutError" ||
    error.message.includes("timed out") ||
    code === "ETIMEDOUT" ||
    code === "ESOCKETTIMEDOUT"
  );
}

function redactSecrets(message: string, apiKey?: string): string {
  let result = message;
  if (apiKey !== undefined && apiKey.length > 0) {
    result = result.split(apiKey).join("[REDACTED]");
  }
  result = result.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]");
  result = result.replace(/tvly-[A-Za-z0-9_-]+/gi, "tvly-[REDACTED]");
  return result;
}

function extractDetailErrorMessage(detail: unknown): {
  message?: string;
  combined: string;
} {
  if (detail === null || typeof detail !== "object") {
    return { combined: "" };
  }
  const record = detail as Record<string, unknown>;
  const message = typeof record.error === "string" ? record.error : undefined;
  return {
    ...(message !== undefined ? { message } : {}),
    combined: `${message ?? ""}`.toLowerCase(),
  };
}

function mapTavilyHttpStatus(
  status: number,
  detailMessage: string | undefined,
  combined: string,
): ConnectorSdkError | undefined {
  if (status === 401 || combined.includes("unauthorized")) {
    return new ConnectorSdkError(
      "UNAUTHORIZED",
      "Tavily API key is invalid or missing.",
    );
  }
  if (
    status === 402 ||
    status === 403 ||
    status === 432 ||
    status === 433 ||
    combined.includes("payment") ||
    combined.includes("plan") ||
    combined.includes("limit exceeded") ||
    combined.includes("quota")
  ) {
    return new ConnectorSdkError(
      "FORBIDDEN",
      status === 402
        ? "Tavily account has insufficient credits."
        : "Tavily denied the request due to plan or usage limits.",
    );
  }
  if (status === 400 || status === 422 || combined.includes("validation")) {
    return new ConnectorSdkError(
      "INVALID_INPUT",
      "Tavily rejected the request parameters.",
    );
  }
  if (status === 429 || combined.includes("rate")) {
    return rateLimitError("Tavily rate limit exceeded.");
  }
  if (detailMessage !== undefined && detailMessage.length > 0 && status < 500) {
    return new ConnectorSdkError("PROVIDER_ERROR", "Tavily request failed.");
  }
  return undefined;
}

export function mapTavilyError(
  error: unknown,
  options?: { readonly apiKey?: string },
): ConnectorSdkError {
  if (error instanceof ConnectorSdkError) {
    return error;
  }
  if (isAbortError(error)) {
    return new ConnectorSdkError("CANCELLED", "Tavily request was cancelled.");
  }
  if (isTimeoutError(error)) {
    return new ConnectorSdkError("TIMEOUT", "Tavily request timed out.");
  }

  if (
    error !== null &&
    typeof error === "object" &&
    "kind" in error &&
    (error as TavilyHttpError).kind === "http"
  ) {
    const http = error as TavilyHttpError;
    const detail = extractDetailErrorMessage(http.detail);
    const mapped = mapTavilyHttpStatus(
      http.status,
      detail.message,
      detail.combined,
    );
    if (mapped !== undefined) {
      return mapped;
    }
    if (http.status >= 500) {
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Tavily service is unavailable.",
      );
    }
    return new ConnectorSdkError("PROVIDER_ERROR", "Tavily request failed.");
  }

  if (error instanceof Error) {
    return new ConnectorSdkError(
      "PROVIDER_ERROR",
      redactSecrets(error.message, options?.apiKey),
    );
  }

  return new ConnectorSdkError(
    "PROVIDER_ERROR",
    "An unexpected Tavily error occurred.",
  );
}
