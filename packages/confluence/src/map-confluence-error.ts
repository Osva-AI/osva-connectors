import { ConnectorSdkError, rateLimitError } from "@osva-ai/connector-sdk";

import type { ConfluenceHttpError } from "./confluence-rest-client.js";

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

function redactSecrets(message: string, credential?: string): string {
  let result = message;
  if (credential !== undefined && credential.length > 0) {
    result = result.split(credential).join("[REDACTED]");
  }
  result = result.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]");
  result = result.replace(/Basic\s+[A-Za-z0-9+/=]+/gi, "Basic [REDACTED]");
  return result;
}

function mapConfluenceErrorBody(
  status: number,
  message: string | undefined,
): ConnectorSdkError | undefined {
  const combined = (message ?? "").toLowerCase();

  if (status === 401 || combined.includes("unauthorized")) {
    return new ConnectorSdkError(
      "UNAUTHORIZED",
      "Confluence credentials are invalid or expired.",
    );
  }
  if (status === 403 || combined.includes("forbidden")) {
    return new ConnectorSdkError(
      "FORBIDDEN",
      "Confluence denied access. Verify site permissions and scopes.",
    );
  }
  if (status === 404 || combined.includes("not found")) {
    return new ConnectorSdkError(
      "NOT_FOUND",
      "Confluence resource was not found.",
    );
  }
  if (status === 400 || combined.includes("validation")) {
    return new ConnectorSdkError(
      "INVALID_INPUT",
      "Confluence rejected the request parameters.",
    );
  }
  if (status === 409 || combined.includes("conflict")) {
    return new ConnectorSdkError(
      "CONFLICT",
      "Confluence page version conflict. Re-fetch the page and retry with the current version number.",
    );
  }
  if (status === 429 || combined.includes("rate limit")) {
    return rateLimitError("Confluence rate limit exceeded.");
  }
  return undefined;
}

export function mapConfluenceError(
  error: unknown,
  options?: {
    readonly credential?: string;
    readonly ambiguousWrite?: boolean;
  },
): ConnectorSdkError {
  if (error instanceof ConnectorSdkError) {
    return error;
  }
  if (isAbortError(error)) {
    return new ConnectorSdkError(
      "CANCELLED",
      "Confluence request was cancelled.",
    );
  }
  if (isTimeoutError(error)) {
    return new ConnectorSdkError(
      "TIMEOUT",
      "Confluence request timed out.",
      options?.ambiguousWrite === true ? { retryable: false } : undefined,
    );
  }

  if (
    error !== null &&
    typeof error === "object" &&
    "kind" in error &&
    (error as ConfluenceHttpError).kind === "http"
  ) {
    const httpError = error as ConfluenceHttpError;
    const mapped = mapConfluenceErrorBody(httpError.status, httpError.message);
    if (mapped !== undefined) {
      return mapped;
    }
    if (httpError.status >= 500) {
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Confluence service error.",
        options?.ambiguousWrite === true ? { retryable: false } : undefined,
      );
    }
    const safeMessage = redactSecrets(
      httpError.message ?? "Confluence request failed.",
      options?.credential,
    );
    return new ConnectorSdkError("PROVIDER_ERROR", safeMessage, {
      retryable: false,
    });
  }

  if (error instanceof Error) {
    return new ConnectorSdkError(
      "PROVIDER_ERROR",
      redactSecrets(error.message, options?.credential),
      options?.ambiguousWrite === true ? { retryable: false } : undefined,
    );
  }

  return new ConnectorSdkError(
    "PROVIDER_ERROR",
    "Confluence request failed.",
    options?.ambiguousWrite === true ? { retryable: false } : undefined,
  );
}
