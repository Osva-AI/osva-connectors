import { ConnectorSdkError, rateLimitError } from "@osva-ai/connector-sdk";

import type { GraphHttpError } from "./graph-rest-client.js";

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
  return result;
}

function mapGraphErrorCode(
  code: string | undefined,
  message: string,
  ambiguousMutation: boolean,
): ConnectorSdkError | undefined {
  const normalized = (code ?? "").toLowerCase();
  const lowerMessage = message.toLowerCase();

  if (
    normalized === "invalidauthenticationtoken" ||
    normalized === "unauthenticated" ||
    lowerMessage.includes("invalid token") ||
    lowerMessage.includes("access token")
  ) {
    return new ConnectorSdkError(
      "UNAUTHORIZED",
      "Microsoft Teams authentication failed.",
    );
  }
  if (
    normalized === "forbidden" ||
    normalized === "authorization_requestdenied" ||
    lowerMessage.includes("insufficient privileges")
  ) {
    return new ConnectorSdkError(
      "FORBIDDEN",
      "Microsoft Teams denied access. Verify delegated OAuth scopes.",
    );
  }
  if (normalized === "itemnotfound" || lowerMessage.includes("not found")) {
    return new ConnectorSdkError(
      "NOT_FOUND",
      "Microsoft Teams resource was not found.",
    );
  }
  if (
    normalized === "activitylimitreached" ||
    normalized === "throttled" ||
    lowerMessage.includes("throttled")
  ) {
    if (ambiguousMutation) {
      return new ConnectorSdkError(
        "RATE_LIMITED",
        "Microsoft Teams rate limit may have been hit; sends are non-idempotent — verify before retrying.",
        { retryable: false },
      );
    }
    return rateLimitError("Microsoft Teams rate limit exceeded.");
  }
  if (normalized === "badrequest" || lowerMessage.includes("bad request")) {
    return new ConnectorSdkError(
      "INVALID_INPUT",
      "Microsoft Teams rejected the request.",
    );
  }
  return undefined;
}

const AMBIGUOUS_SEND_MESSAGE =
  "Microsoft Teams did not return a confirmable send response. A message may still have been posted; verify the channel or chat before retrying.";

export interface MapTeamsErrorOptions {
  readonly accessToken?: string;
  readonly ambiguousMutation?: boolean;
}

export function mapTeamsError(
  error: unknown,
  options?: MapTeamsErrorOptions,
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
    return new ConnectorSdkError(
      "TIMEOUT",
      "Microsoft Teams request timed out.",
      { retryable: true },
    );
  }

  if (
    error !== null &&
    typeof error === "object" &&
    "kind" in error &&
    (error as GraphHttpError).kind === "http"
  ) {
    const httpError = error as GraphHttpError;
    const mapped = mapGraphErrorCode(
      httpError.graphCode,
      httpError.graphMessage ?? "",
      ambiguousMutation,
    );
    if (mapped !== undefined) {
      return mapped;
    }
    if (httpError.status === 401) {
      return new ConnectorSdkError(
        "UNAUTHORIZED",
        "Microsoft Teams authentication failed.",
      );
    }
    if (httpError.status === 403) {
      return new ConnectorSdkError(
        "FORBIDDEN",
        "Microsoft Teams denied access to this resource.",
      );
    }
    if (httpError.status === 404) {
      return new ConnectorSdkError(
        "NOT_FOUND",
        "Microsoft Teams resource was not found.",
      );
    }
    if (httpError.status === 429) {
      if (ambiguousMutation) {
        return new ConnectorSdkError("RATE_LIMITED", AMBIGUOUS_SEND_MESSAGE, {
          retryable: false,
        });
      }
      return rateLimitError("Microsoft Teams rate limit exceeded.");
    }
    if (httpError.status >= 500) {
      if (ambiguousMutation) {
        return new ConnectorSdkError("PROVIDER_ERROR", AMBIGUOUS_SEND_MESSAGE, {
          retryable: false,
        });
      }
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Microsoft Teams is temporarily unavailable.",
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
        "An unexpected error occurred while contacting Microsoft Teams.",
      );
    }
  }

  return new ConnectorSdkError(
    "PROVIDER_ERROR",
    "An unexpected error occurred while contacting Microsoft Teams.",
  );
}
