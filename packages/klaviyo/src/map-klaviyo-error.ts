import { ConnectorSdkError, rateLimitError } from "@osva-ai/connector-sdk";

import type { KlaviyoHttpError } from "./klaviyo-rest-client.js";

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

function redactSecrets(message: string, privateApiKey?: string): string {
  let result = message;
  if (privateApiKey !== undefined && privateApiKey.length > 0) {
    result = result.split(privateApiKey).join("[REDACTED]");
  }
  result = result.replace(
    /Klaviyo-API-Key\s+[A-Za-z0-9_-]+/gi,
    "Klaviyo-API-Key [REDACTED]",
  );
  return result;
}

function mapKlaviyoErrorDetail(
  code: string | undefined,
  title: string | undefined,
  detail: string | undefined,
): ConnectorSdkError | undefined {
  const combined = `${title ?? ""} ${detail ?? ""}`.toLowerCase();
  const normalizedCode = (code ?? "").toLowerCase();

  if (
    normalizedCode === "authentication_failed" ||
    combined.includes("authentication") ||
    combined.includes("invalid api key")
  ) {
    return new ConnectorSdkError(
      "UNAUTHORIZED",
      "Klaviyo API key is invalid or missing required scopes.",
    );
  }
  if (
    normalizedCode === "permission_denied" ||
    combined.includes("permission") ||
    combined.includes("forbidden")
  ) {
    return new ConnectorSdkError(
      "FORBIDDEN",
      "Klaviyo denied access. Verify API key scopes and account permissions.",
    );
  }
  if (normalizedCode === "not_found" || combined.includes("not found")) {
    return new ConnectorSdkError(
      "NOT_FOUND",
      "Klaviyo resource was not found.",
    );
  }
  if (normalizedCode === "invalid" || combined.includes("invalid input")) {
    return new ConnectorSdkError(
      "INVALID_INPUT",
      "Klaviyo rejected the request parameters.",
    );
  }
  if (
    normalizedCode === "throttled" ||
    combined.includes("rate limit") ||
    combined.includes("too many requests")
  ) {
    return rateLimitError("Klaviyo rate limit exceeded.");
  }
  return undefined;
}

export interface MapKlaviyoErrorOptions {
  readonly privateApiKey?: string;
}

export function mapKlaviyoError(
  error: unknown,
  options?: MapKlaviyoErrorOptions,
): ConnectorSdkError {
  const privateApiKey = options?.privateApiKey;

  if (error instanceof ConnectorSdkError) {
    return error;
  }

  if (isAbortError(error)) {
    return new ConnectorSdkError("CANCELLED", "Request was cancelled.");
  }

  if (isTimeoutError(error)) {
    return new ConnectorSdkError("TIMEOUT", "Klaviyo request timed out.", {
      retryable: true,
    });
  }

  if (
    error !== null &&
    typeof error === "object" &&
    "kind" in error &&
    (error as KlaviyoHttpError).kind === "http"
  ) {
    const httpError = error as KlaviyoHttpError;
    const mapped = mapKlaviyoErrorDetail(
      httpError.klaviyoCode,
      httpError.klaviyoTitle,
      httpError.klaviyoDetail,
    );
    if (mapped !== undefined) {
      return mapped;
    }
    if (httpError.status === 401) {
      return new ConnectorSdkError(
        "UNAUTHORIZED",
        "Klaviyo authentication failed.",
      );
    }
    if (httpError.status === 403) {
      return new ConnectorSdkError(
        "FORBIDDEN",
        "Klaviyo denied access to this resource.",
      );
    }
    if (httpError.status === 404) {
      return new ConnectorSdkError(
        "NOT_FOUND",
        "Klaviyo resource was not found.",
      );
    }
    if (httpError.status === 429) {
      return rateLimitError("Klaviyo rate limit exceeded.");
    }
    if (httpError.status >= 500) {
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Klaviyo is temporarily unavailable.",
        { retryable: true },
      );
    }
  }

  if (error instanceof Error) {
    const sanitized = redactSecrets(error.message, privateApiKey);
    if (sanitized.includes("[REDACTED]") && sanitized.length > 80) {
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        "An unexpected error occurred while contacting Klaviyo.",
      );
    }
  }

  return new ConnectorSdkError(
    "PROVIDER_ERROR",
    "An unexpected error occurred while contacting Klaviyo.",
  );
}
