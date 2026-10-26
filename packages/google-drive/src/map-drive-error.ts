import { ConnectorSdkError, rateLimitError } from "@osva-ai/connector-sdk";

import type { DriveHttpError } from "./drive-rest-client.js";

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
      "Google Drive authentication failed.",
    );
  }
  if (
    normalized === "PERMISSION_DENIED" ||
    lowerMessage.includes("permission denied") ||
    lowerMessage.includes("insufficient permissions")
  ) {
    return new ConnectorSdkError(
      "FORBIDDEN",
      "Google Drive denied access. Verify OAuth scope and file or shared-drive permissions.",
    );
  }
  if (normalized === "NOT_FOUND" || lowerMessage.includes("not found")) {
    return new ConnectorSdkError(
      "NOT_FOUND",
      "Google Drive resource was not found.",
    );
  }
  if (
    normalized === "RESOURCE_EXHAUSTED" ||
    lowerMessage.includes("quota") ||
    lowerMessage.includes("rate limit")
  ) {
    return rateLimitError("Google Drive quota or rate limit exceeded.");
  }
  if (
    normalized === "INVALID_ARGUMENT" ||
    lowerMessage.includes("invalid argument")
  ) {
    return new ConnectorSdkError(
      "INVALID_INPUT",
      "Google Drive rejected the request.",
    );
  }
  return undefined;
}

export interface MapDriveErrorOptions {
  readonly accessToken?: string;
}

export function mapDriveError(
  error: unknown,
  options?: MapDriveErrorOptions,
): ConnectorSdkError {
  const accessToken = options?.accessToken;

  if (error instanceof ConnectorSdkError) {
    return error;
  }

  if (isAbortError(error)) {
    return new ConnectorSdkError("CANCELLED", "Request was cancelled.");
  }

  if (isTimeoutError(error)) {
    return new ConnectorSdkError("TIMEOUT", "Google Drive request timed out.", {
      retryable: true,
    });
  }

  if (
    error !== null &&
    typeof error === "object" &&
    "kind" in error &&
    (error as DriveHttpError).kind === "http"
  ) {
    const httpError = error as DriveHttpError;
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
    if (httpError.status === 401) {
      return new ConnectorSdkError(
        "UNAUTHORIZED",
        "Google Drive authentication failed.",
      );
    }
    if (httpError.status === 403) {
      const msg = (httpError.googleMessage ?? "").toLowerCase();
      if (msg.includes("quota") || msg.includes("rate")) {
        return rateLimitError("Google Drive quota or rate limit exceeded.");
      }
      return new ConnectorSdkError(
        "FORBIDDEN",
        "Google Drive denied access to this file or shared drive.",
      );
    }
    if (httpError.status === 404) {
      return new ConnectorSdkError(
        "NOT_FOUND",
        "Google Drive resource was not found.",
      );
    }
    if (httpError.status === 429) {
      return rateLimitError("Google Drive quota or rate limit exceeded.");
    }
    if (httpError.status >= 500) {
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Google Drive is temporarily unavailable.",
        { retryable: true },
      );
    }
  }

  if (error instanceof Error) {
    const sanitized = redactSecrets(error.message, accessToken);
    if (sanitized.includes("[REDACTED]") && sanitized.length > 80) {
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        "An unexpected error occurred while contacting Google Drive.",
      );
    }
  }

  return new ConnectorSdkError(
    "PROVIDER_ERROR",
    "An unexpected error occurred while contacting Google Drive.",
  );
}
