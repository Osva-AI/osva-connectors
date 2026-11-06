import { ConnectorSdkError, rateLimitError } from "@osva-ai/connector-sdk";

import type { GmailHttpError } from "./gmail-rest-client.js";

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
      "Gmail authentication failed.",
    );
  }
  if (
    normalized === "PERMISSION_DENIED" ||
    lowerMessage.includes("permission denied") ||
    lowerMessage.includes("insufficient permissions")
  ) {
    return new ConnectorSdkError(
      "FORBIDDEN",
      "Gmail denied access. Verify OAuth scopes and mailbox permissions.",
    );
  }
  if (normalized === "NOT_FOUND" || lowerMessage.includes("not found")) {
    return new ConnectorSdkError("NOT_FOUND", "Gmail resource was not found.");
  }
  if (
    normalized === "RESOURCE_EXHAUSTED" ||
    lowerMessage.includes("quota") ||
    lowerMessage.includes("rate limit")
  ) {
    if (ambiguousMutation) {
      return new ConnectorSdkError(
        "RATE_LIMITED",
        "Gmail rate limit may have been hit; sending is non-idempotent — verify before retrying.",
        { retryable: false },
      );
    }
    return rateLimitError("Gmail quota or rate limit exceeded.");
  }
  if (
    normalized === "INVALID_ARGUMENT" ||
    lowerMessage.includes("invalid argument")
  ) {
    return new ConnectorSdkError(
      "INVALID_INPUT",
      "Gmail rejected the request.",
    );
  }
  return undefined;
}

const AMBIGUOUS_SEND_MESSAGE =
  "Gmail did not return a confirmable send response. A message may still have been sent; verify Sent mail before retrying.";

export interface MapGmailErrorOptions {
  readonly accessToken?: string;
  readonly ambiguousMutation?: boolean;
}

export function mapGmailError(
  error: unknown,
  options?: MapGmailErrorOptions,
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
      return new ConnectorSdkError("TIMEOUT", AMBIGUOUS_SEND_MESSAGE, {
        retryable: false,
      });
    }
    return new ConnectorSdkError("TIMEOUT", "Gmail request timed out.", {
      retryable: true,
    });
  }

  if (
    error !== null &&
    typeof error === "object" &&
    "kind" in error &&
    (error as GmailHttpError).kind === "http"
  ) {
    const httpError = error as GmailHttpError;
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
        "Gmail authentication failed.",
      );
    }
    if (httpError.status === 403) {
      return new ConnectorSdkError(
        "FORBIDDEN",
        "Gmail denied access to this resource.",
      );
    }
    if (httpError.status === 404) {
      return new ConnectorSdkError(
        "NOT_FOUND",
        "Gmail resource was not found.",
      );
    }
    if (httpError.status === 429) {
      if (ambiguousMutation) {
        return new ConnectorSdkError("RATE_LIMITED", AMBIGUOUS_SEND_MESSAGE, {
          retryable: false,
        });
      }
      return rateLimitError("Gmail rate limit exceeded.");
    }
    if (httpError.status >= 500) {
      if (ambiguousMutation) {
        return new ConnectorSdkError("PROVIDER_ERROR", AMBIGUOUS_SEND_MESSAGE, {
          retryable: false,
        });
      }
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Gmail is temporarily unavailable.",
        { retryable: true },
      );
    }
  }

  if (ambiguousMutation) {
    return new ConnectorSdkError("PROVIDER_ERROR", AMBIGUOUS_SEND_MESSAGE, {
      retryable: false,
    });
  }

  if (error instanceof Error) {
    const sanitized = redactSecrets(error.message, accessToken);
    if (sanitized.includes("[REDACTED]") && sanitized.length > 80) {
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        "An unexpected error occurred while contacting Gmail.",
      );
    }
  }

  return new ConnectorSdkError(
    "PROVIDER_ERROR",
    "An unexpected error occurred while contacting Gmail.",
  );
}
