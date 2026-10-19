import { ConnectorSdkError, rateLimitError } from "@osva-ai/connector-sdk";

import type { Ga4HttpError } from "./ga4-rest-client.js";

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
  result = result.replace(
    /"access_token"\s*:\s*"[^"]+"/gi,
    '"access_token":"[REDACTED]"',
  );
  result = result.replace(
    /"refresh_token"\s*:\s*"[^"]+"/gi,
    '"refresh_token":"[REDACTED]"',
  );
  result = result.replace(
    /-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/g,
    "[REDACTED]",
  );
  return result;
}

function mapGoogleErrorStatus(
  status: string | undefined,
  message: string,
): ConnectorSdkError | undefined {
  const normalized = (status ?? "").toUpperCase();
  const lowerMessage = message.toLowerCase();

  if (
    normalized === "UNAUTHENTICATED" ||
    lowerMessage.includes("invalid credentials") ||
    lowerMessage.includes("invalid_grant")
  ) {
    return new ConnectorSdkError(
      "UNAUTHORIZED",
      "Google Analytics authentication failed.",
    );
  }
  if (
    normalized === "PERMISSION_DENIED" ||
    lowerMessage.includes("permission denied") ||
    lowerMessage.includes("insufficient permissions")
  ) {
    return new ConnectorSdkError(
      "FORBIDDEN",
      "Google Analytics denied access. Verify the credential has analytics.readonly scope and access to the GA4 property.",
    );
  }
  if (normalized === "NOT_FOUND" || lowerMessage.includes("not found")) {
    return new ConnectorSdkError(
      "NOT_FOUND",
      "Google Analytics resource was not found.",
    );
  }
  if (
    normalized === "RESOURCE_EXHAUSTED" ||
    lowerMessage.includes("quota") ||
    lowerMessage.includes("rate limit")
  ) {
    return rateLimitError("Google Analytics quota or rate limit exceeded.");
  }
  if (
    normalized === "INVALID_ARGUMENT" ||
    lowerMessage.includes("invalid argument")
  ) {
    return new ConnectorSdkError(
      "INVALID_INPUT",
      "Google Analytics rejected the report request.",
    );
  }
  return undefined;
}

export interface MapGa4ErrorOptions {
  readonly accessToken?: string;
}

export function mapGa4Error(
  error: unknown,
  options?: MapGa4ErrorOptions,
): ConnectorSdkError {
  const accessToken = options?.accessToken;

  if (error instanceof ConnectorSdkError) {
    return error;
  }

  if (isAbortError(error)) {
    return new ConnectorSdkError("CANCELLED", "Request was cancelled.");
  }

  if (isTimeoutError(error)) {
    return new ConnectorSdkError(
      "TIMEOUT",
      "Google Analytics request timed out.",
      {
        retryable: true,
      },
    );
  }

  if (
    error !== null &&
    typeof error === "object" &&
    "kind" in error &&
    (error as Ga4HttpError).kind === "http"
  ) {
    const httpError = error as Ga4HttpError;
    if (httpError.status === 401) {
      return new ConnectorSdkError(
        "UNAUTHORIZED",
        "Google Analytics authentication failed.",
      );
    }
    if (httpError.status === 403) {
      return new ConnectorSdkError(
        "FORBIDDEN",
        "Google Analytics denied access to this property or resource.",
      );
    }
    if (httpError.status === 404) {
      return new ConnectorSdkError(
        "NOT_FOUND",
        "Google Analytics resource was not found.",
      );
    }
    if (httpError.status === 429) {
      return rateLimitError("Google Analytics quota or rate limit exceeded.");
    }
    if (httpError.status >= 500) {
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Google Analytics is temporarily unavailable.",
        { retryable: true },
      );
    }
    if (
      httpError.googleStatus !== undefined ||
      httpError.googleMessage !== undefined
    ) {
      const mapped = mapGoogleErrorStatus(
        httpError.googleStatus,
        httpError.googleMessage ?? "",
      );
      if (mapped !== undefined) {
        return mapped;
      }
    }
  }

  if (error instanceof Error) {
    const sanitized = redactSecrets(error.message, accessToken);
    if (sanitized.includes("[REDACTED]") && sanitized.length > 80) {
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        "An unexpected error occurred while contacting Google Analytics.",
      );
    }
  }

  return new ConnectorSdkError(
    "PROVIDER_ERROR",
    "An unexpected error occurred while contacting Google Analytics.",
  );
}
