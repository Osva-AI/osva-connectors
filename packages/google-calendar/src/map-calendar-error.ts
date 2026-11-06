import { ConnectorSdkError, rateLimitError } from "@osva-ai/connector-sdk";

import type { CalendarHttpError } from "./calendar-rest-client.js";

const AMBIGUOUS_MUTATION =
  "Google Calendar did not return a confirmable response. The change may still have been applied; verify in Calendar before retrying.";

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
  return result;
}

function mapGoogleErrorStatus(
  status: string | undefined,
  message: string,
  ambiguousMutation: boolean,
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
      "Google Calendar authentication failed.",
    );
  }
  if (
    normalized === "PERMISSION_DENIED" ||
    lowerMessage.includes("permission denied") ||
    lowerMessage.includes("insufficient permissions")
  ) {
    return new ConnectorSdkError(
      "FORBIDDEN",
      "Google Calendar denied access. Verify OAuth scopes and calendar ACLs.",
    );
  }
  if (normalized === "NOT_FOUND" || lowerMessage.includes("not found")) {
    return new ConnectorSdkError(
      "NOT_FOUND",
      "Google Calendar resource was not found.",
    );
  }
  if (
    normalized === "RESOURCE_EXHAUSTED" ||
    lowerMessage.includes("quota") ||
    lowerMessage.includes("rate limit")
  ) {
    if (ambiguousMutation) {
      return new ConnectorSdkError("RATE_LIMITED", AMBIGUOUS_MUTATION, {
        retryable: false,
      });
    }
    return rateLimitError("Google Calendar quota or rate limit exceeded.");
  }
  if (
    normalized === "INVALID_ARGUMENT" ||
    lowerMessage.includes("invalid argument")
  ) {
    return new ConnectorSdkError(
      "INVALID_INPUT",
      "Google Calendar rejected the request.",
    );
  }
  if (normalized === "FAILED_PRECONDITION") {
    return new ConnectorSdkError(
      "INVALID_INPUT",
      "Google Calendar rejected the request (failed precondition).",
    );
  }
  return undefined;
}

export interface MapCalendarErrorOptions {
  readonly accessToken?: string;
  readonly ambiguousMutation?: boolean;
}

export function mapCalendarError(
  error: unknown,
  options?: MapCalendarErrorOptions,
): ConnectorSdkError {
  const accessToken = options?.accessToken;
  const ambiguousMutation = options?.ambiguousMutation === true;

  if (error instanceof ConnectorSdkError) {
    return error;
  }

  if (isAbortError(error)) {
    return new ConnectorSdkError("CANCELLED", "Request was cancelled.");
  }

  if (isTimeoutError(error)) {
    if (ambiguousMutation) {
      return new ConnectorSdkError("TIMEOUT", AMBIGUOUS_MUTATION, {
        retryable: false,
      });
    }
    return new ConnectorSdkError(
      "TIMEOUT",
      "Google Calendar request timed out.",
      { retryable: true },
    );
  }

  if (
    error !== null &&
    typeof error === "object" &&
    "kind" in error &&
    (error as CalendarHttpError).kind === "http"
  ) {
    const httpError = error as CalendarHttpError;
    const mapped = mapGoogleErrorStatus(
      httpError.googleStatus,
      httpError.googleMessage ?? "",
      ambiguousMutation,
    );
    if (mapped !== undefined) {
      return mapped;
    }
    if (httpError.status === 401) {
      return new ConnectorSdkError(
        "UNAUTHORIZED",
        "Google Calendar authentication failed.",
      );
    }
    if (httpError.status === 403) {
      return new ConnectorSdkError(
        "FORBIDDEN",
        "Google Calendar denied access to this resource.",
      );
    }
    if (httpError.status === 404) {
      return new ConnectorSdkError(
        "NOT_FOUND",
        "Google Calendar resource was not found.",
      );
    }
    if (httpError.status === 429) {
      if (ambiguousMutation) {
        return new ConnectorSdkError("RATE_LIMITED", AMBIGUOUS_MUTATION, {
          retryable: false,
        });
      }
      return rateLimitError("Google Calendar rate limit exceeded.");
    }
    if (httpError.status >= 500) {
      if (ambiguousMutation) {
        return new ConnectorSdkError("PROVIDER_ERROR", AMBIGUOUS_MUTATION, {
          retryable: false,
        });
      }
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Google Calendar is temporarily unavailable.",
        { retryable: true },
      );
    }
  }

  if (ambiguousMutation) {
    return new ConnectorSdkError("PROVIDER_ERROR", AMBIGUOUS_MUTATION, {
      retryable: false,
    });
  }

  if (error instanceof Error) {
    const sanitized = redactSecrets(error.message, accessToken);
    if (sanitized.includes("[REDACTED]") && sanitized.length > 80) {
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        "An unexpected error occurred while contacting Google Calendar.",
      );
    }
  }

  return new ConnectorSdkError(
    "PROVIDER_ERROR",
    "An unexpected error occurred while contacting Google Calendar.",
  );
}
