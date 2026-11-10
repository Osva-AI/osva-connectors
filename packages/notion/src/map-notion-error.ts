import { ConnectorSdkError, rateLimitError } from "@osva-ai/connector-sdk";

import type { NotionHttpError } from "./notion-rest-client.js";

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

function redactSecrets(message: string, accessToken?: string): string {
  let result = message;
  if (accessToken !== undefined && accessToken.length > 0) {
    result = result.split(accessToken).join("[REDACTED]");
  }
  result = result.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]");
  result = result.replace(/secret_[A-Za-z0-9]+/gi, "secret_[REDACTED]");
  result = result.replace(/ntn_[A-Za-z0-9]+/gi, "ntn_[REDACTED]");
  return result;
}

function mapNotionErrorBody(
  status: number,
  code: string | undefined,
  message: string | undefined,
): ConnectorSdkError | undefined {
  const combined = `${code ?? ""} ${message ?? ""}`.toLowerCase();

  if (status === 401 || combined.includes("unauthorized")) {
    return new ConnectorSdkError(
      "UNAUTHORIZED",
      "Notion integration token is invalid or expired.",
    );
  }
  if (
    status === 403 ||
    combined.includes("restricted") ||
    combined.includes("forbidden")
  ) {
    return new ConnectorSdkError(
      "FORBIDDEN",
      "Notion denied access. Verify integration capabilities and shared pages.",
    );
  }
  if (status === 404 || combined.includes("not found")) {
    return new ConnectorSdkError(
      "NOT_FOUND",
      "Notion resource was not found or is not shared with the integration.",
    );
  }
  if (status === 400 || combined.includes("validation")) {
    return new ConnectorSdkError(
      "INVALID_INPUT",
      "Notion rejected the request parameters.",
    );
  }
  if (
    status === 429 ||
    combined.includes("rate limit") ||
    combined.includes("rate_limited")
  ) {
    return rateLimitError("Notion rate limit exceeded.");
  }
  return undefined;
}

export function mapNotionError(
  error: unknown,
  options?: {
    readonly accessToken?: string;
    readonly ambiguousWrite?: boolean;
  },
): ConnectorSdkError {
  if (error instanceof ConnectorSdkError) {
    return error;
  }
  if (isAbortError(error)) {
    return new ConnectorSdkError(
      "CANCELLED",
      "Notion request was cancelled.",
      options?.ambiguousWrite === true ? { retryable: false } : undefined,
    );
  }
  if (isTimeoutError(error)) {
    return new ConnectorSdkError(
      "TIMEOUT",
      "Notion request timed out.",
      options?.ambiguousWrite === true ? { retryable: false } : undefined,
    );
  }

  if (
    error !== null &&
    typeof error === "object" &&
    "kind" in error &&
    (error as NotionHttpError).kind === "http"
  ) {
    const httpError = error as NotionHttpError;
    const mapped = mapNotionErrorBody(
      httpError.status,
      httpError.notionCode,
      httpError.notionMessage,
    );
    if (mapped !== undefined) {
      return mapped;
    }
    if (httpError.status >= 500) {
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Notion service error.",
        options?.ambiguousWrite === true ? { retryable: false } : undefined,
      );
    }
    const safeMessage = redactSecrets(
      httpError.notionMessage ?? "Notion request failed.",
      options?.accessToken,
    );
    return new ConnectorSdkError("PROVIDER_ERROR", safeMessage, {
      retryable: false,
    });
  }

  if (error instanceof Error) {
    return new ConnectorSdkError(
      "PROVIDER_ERROR",
      redactSecrets(error.message, options?.accessToken),
      options?.ambiguousWrite === true ? { retryable: false } : undefined,
    );
  }

  return new ConnectorSdkError(
    "PROVIDER_ERROR",
    "Notion request failed.",
    options?.ambiguousWrite === true ? { retryable: false } : undefined,
  );
}
