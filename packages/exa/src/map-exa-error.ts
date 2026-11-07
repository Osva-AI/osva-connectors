import { ConnectorSdkError, rateLimitError } from "@osva-ai/connector-sdk";

import type { ExaHttpError } from "./exa-rest-client.js";

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
  result = result.replace(/x-api-key:\s*\S+/gi, "x-api-key: [REDACTED]");
  result = result.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]");
  return result;
}

function mapExaErrorBody(
  status: number,
  tag: string | undefined,
  errorMessage: string | undefined,
): ConnectorSdkError | undefined {
  const combined = `${tag ?? ""} ${errorMessage ?? ""}`.toLowerCase();

  if (status === 401 || combined.includes("unauthorized")) {
    return new ConnectorSdkError(
      "UNAUTHORIZED",
      "Exa API key is invalid or missing.",
    );
  }
  if (status === 402 || combined.includes("payment")) {
    return new ConnectorSdkError(
      "FORBIDDEN",
      "Exa account billing or quota does not allow this request.",
    );
  }
  if (status === 403 || combined.includes("forbidden")) {
    return new ConnectorSdkError("FORBIDDEN", "Exa denied access.");
  }
  if (status === 404 || combined.includes("not found")) {
    return new ConnectorSdkError("NOT_FOUND", "Exa resource was not found.");
  }
  if (status === 400 || combined.includes("invalid")) {
    return new ConnectorSdkError(
      "INVALID_INPUT",
      "Exa rejected the request parameters.",
    );
  }
  if (
    status === 429 ||
    combined.includes("rate limit") ||
    combined.includes("too many")
  ) {
    return rateLimitError("Exa rate limit exceeded.");
  }
  return undefined;
}

export interface MapExaErrorOptions {
  readonly apiKey?: string;
  /** When true, timeouts and server errors are not retryable (billable / ambiguous ops). */
  readonly ambiguousCostOp?: boolean;
}

export function mapExaError(
  error: unknown,
  options?: MapExaErrorOptions,
): ConnectorSdkError {
  const apiKey = options?.apiKey;
  const ambiguousCostOp = options?.ambiguousCostOp === true;

  if (error instanceof ConnectorSdkError) {
    return error;
  }
  if (isAbortError(error)) {
    return new ConnectorSdkError("CANCELLED", "Exa request was cancelled.");
  }
  if (isTimeoutError(error)) {
    return new ConnectorSdkError(
      "TIMEOUT",
      "Exa request timed out.",
      ambiguousCostOp ? { retryable: false } : undefined,
    );
  }

  if (
    error !== null &&
    typeof error === "object" &&
    "kind" in error &&
    (error as ExaHttpError).kind === "http"
  ) {
    const httpError = error as ExaHttpError;
    const mapped = mapExaErrorBody(
      httpError.status,
      httpError.exaTag,
      httpError.exaMessage,
    );
    if (mapped !== undefined) {
      return mapped;
    }
    if (httpError.status >= 500) {
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Exa service error.",
        ambiguousCostOp ? { retryable: false } : undefined,
      );
    }
    const safeMessage = redactSecrets(
      httpError.exaMessage ?? "Exa request failed.",
      apiKey,
    );
    return new ConnectorSdkError("PROVIDER_ERROR", safeMessage, {
      retryable: false,
    });
  }

  if (error instanceof Error) {
    return new ConnectorSdkError(
      "PROVIDER_ERROR",
      redactSecrets(error.message, apiKey),
      ambiguousCostOp ? { retryable: false } : undefined,
    );
  }

  return new ConnectorSdkError(
    "PROVIDER_ERROR",
    "Exa request failed.",
    ambiguousCostOp ? { retryable: false } : undefined,
  );
}
