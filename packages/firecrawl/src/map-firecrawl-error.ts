import { ConnectorSdkError, rateLimitError } from "@osva-ai/connector-sdk";

import type { FirecrawlHttpError } from "./firecrawl-rest-client.js";

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
  result = result.replace(/Bearer\s+[A-Za-z0-9_-]+/gi, "Bearer [REDACTED]");
  return result;
}

function mapFirecrawlErrorDetail(
  message: string | undefined,
): ConnectorSdkError | undefined {
  const combined = (message ?? "").toLowerCase();

  if (
    combined.includes("authentication") ||
    combined.includes("unauthorized") ||
    combined.includes("invalid api key")
  ) {
    return new ConnectorSdkError(
      "UNAUTHORIZED",
      "Firecrawl API key is invalid or missing required access.",
    );
  }
  if (combined.includes("forbidden") || combined.includes("permission")) {
    return new ConnectorSdkError(
      "FORBIDDEN",
      "Firecrawl denied access. Verify API key permissions.",
    );
  }
  if (combined.includes("not found")) {
    return new ConnectorSdkError(
      "NOT_FOUND",
      "Firecrawl resource was not found.",
    );
  }
  if (combined.includes("invalid") || combined.includes("bad request")) {
    return new ConnectorSdkError(
      "INVALID_INPUT",
      "Firecrawl rejected the request parameters.",
    );
  }
  if (
    combined.includes("rate limit") ||
    combined.includes("too many requests")
  ) {
    return rateLimitError("Firecrawl rate limit exceeded.");
  }
  if (
    combined.includes("payment required") ||
    combined.includes("insufficient credits")
  ) {
    return new ConnectorSdkError(
      "FORBIDDEN",
      "Firecrawl account has insufficient credits.",
    );
  }
  return undefined;
}

export interface MapFirecrawlErrorOptions {
  readonly apiKey?: string;
}

export function mapFirecrawlError(
  error: unknown,
  options?: MapFirecrawlErrorOptions,
): ConnectorSdkError {
  const apiKey = options?.apiKey;

  if (error instanceof ConnectorSdkError) {
    return error;
  }

  if (isAbortError(error)) {
    return new ConnectorSdkError("CANCELLED", "Request was cancelled.");
  }

  if (isTimeoutError(error)) {
    return new ConnectorSdkError("TIMEOUT", "Firecrawl request timed out.", {
      retryable: true,
    });
  }

  if (
    error !== null &&
    typeof error === "object" &&
    "kind" in error &&
    (error as FirecrawlHttpError).kind === "http"
  ) {
    const httpError = error as FirecrawlHttpError;
    const mapped = mapFirecrawlErrorDetail(httpError.firecrawlError);
    if (mapped !== undefined) {
      return mapped;
    }
    if (httpError.status === 401) {
      return new ConnectorSdkError(
        "UNAUTHORIZED",
        "Firecrawl authentication failed.",
      );
    }
    if (httpError.status === 402) {
      return new ConnectorSdkError(
        "FORBIDDEN",
        "Firecrawl account has insufficient credits.",
      );
    }
    if (httpError.status === 403) {
      return new ConnectorSdkError(
        "FORBIDDEN",
        "Firecrawl denied access to this resource.",
      );
    }
    if (httpError.status === 404) {
      return new ConnectorSdkError(
        "NOT_FOUND",
        "Firecrawl resource was not found.",
      );
    }
    if (httpError.status === 429) {
      return rateLimitError("Firecrawl rate limit exceeded.");
    }
    if (httpError.status >= 500) {
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Firecrawl is temporarily unavailable.",
        { retryable: true },
      );
    }
  }

  if (error instanceof Error) {
    const sanitized = redactSecrets(error.message, apiKey);
    if (sanitized.includes("[REDACTED]") && sanitized.length > 80) {
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        "An unexpected error occurred while contacting Firecrawl.",
      );
    }
  }

  return new ConnectorSdkError(
    "PROVIDER_ERROR",
    "An unexpected error occurred while contacting Firecrawl.",
  );
}
