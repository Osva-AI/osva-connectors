import { ConnectorSdkError, rateLimitError } from "@osva-ai/connector-sdk";

import type { OneDriveHttpError } from "./onedrive-rest-client.js";

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
  result = result.replace(
    /Bearer\s+[A-Za-z0-9._~+/=-]+/gi,
    "Bearer [REDACTED]",
  );
  return result;
}

function mapGraphErrorCode(
  code: string | undefined,
  message: string,
): ConnectorSdkError | undefined {
  const normalized = (code ?? "").toLowerCase();
  const lowerMessage = message.toLowerCase();

  if (
    normalized === "invalidauthenticationtoken" ||
    normalized === "unauthenticated" ||
    lowerMessage.includes("access token") ||
    lowerMessage.includes("unauthorized")
  ) {
    return new ConnectorSdkError(
      "UNAUTHORIZED",
      "OneDrive authentication failed.",
    );
  }
  if (
    normalized === "accessdenied" ||
    lowerMessage.includes("access denied") ||
    lowerMessage.includes("forbidden")
  ) {
    return new ConnectorSdkError(
      "FORBIDDEN",
      "OneDrive denied access. Verify delegated permissions and item permissions.",
    );
  }
  if (
    normalized === "itemnotfound" ||
    normalized === "resourcenotfound" ||
    lowerMessage.includes("not found")
  ) {
    return new ConnectorSdkError(
      "NOT_FOUND",
      "OneDrive resource was not found.",
    );
  }
  if (
    normalized === "activitylimitreached" ||
    normalized === "throttledrequest" ||
    lowerMessage.includes("throttl") ||
    lowerMessage.includes("rate")
  ) {
    return rateLimitError("OneDrive quota or rate limit exceeded.");
  }
  return undefined;
}

export interface MapOneDriveErrorOptions {
  readonly accessToken?: string;
}

export function mapOneDriveError(
  error: unknown,
  options?: MapOneDriveErrorOptions,
): ConnectorSdkError {
  const accessToken = options?.accessToken;

  if (error instanceof ConnectorSdkError) {
    return error;
  }

  if (isAbortError(error)) {
    return new ConnectorSdkError("CANCELLED", "Request was cancelled.");
  }

  if (isTimeoutError(error)) {
    return new ConnectorSdkError("TIMEOUT", "OneDrive request timed out.", {
      retryable: true,
    });
  }

  if (
    error !== null &&
    typeof error === "object" &&
    "kind" in error &&
    (error as OneDriveHttpError).kind === "http"
  ) {
    const httpError = error as OneDriveHttpError;
    const mapped = mapGraphErrorCode(
      httpError.graphCode,
      httpError.graphMessage ?? "",
    );
    if (mapped !== undefined) {
      return mapped;
    }
    if (httpError.status === 401) {
      return new ConnectorSdkError(
        "UNAUTHORIZED",
        "OneDrive authentication failed.",
      );
    }
    if (httpError.status === 403) {
      return new ConnectorSdkError(
        "FORBIDDEN",
        "OneDrive denied access to this drive or item.",
      );
    }
    if (httpError.status === 404) {
      return new ConnectorSdkError(
        "NOT_FOUND",
        "OneDrive resource was not found.",
      );
    }
    if (httpError.status === 429) {
      return rateLimitError("OneDrive quota or rate limit exceeded.");
    }
    if (httpError.status >= 500) {
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        "OneDrive is temporarily unavailable.",
        { retryable: true },
      );
    }
  }

  if (error instanceof Error) {
    const sanitized = redactSecrets(error.message, accessToken);
    if (sanitized.includes("[REDACTED]") && sanitized.length > 80) {
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        "An unexpected error occurred while contacting OneDrive.",
      );
    }
  }

  return new ConnectorSdkError(
    "PROVIDER_ERROR",
    "An unexpected error occurred while contacting OneDrive.",
  );
}
