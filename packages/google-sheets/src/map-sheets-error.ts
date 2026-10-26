import { ConnectorSdkError, rateLimitError } from "@osva-ai/connector-sdk";

import type { SheetsHttpError } from "./sheets-rest-client.js";

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

export interface MapSheetsErrorOptions {
  readonly accessToken?: string;
  readonly ambiguousWrite?: boolean;
}

const AMBIGUOUS_WRITE_MESSAGE =
  "Google Sheets did not return a confirmable response. The change may still have been applied; verify in the spreadsheet before retrying.";

function mapGoogleErrorStatus(
  status: string | undefined,
  message: string,
  ambiguousWrite: boolean,
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
      "Google Sheets authentication failed.",
    );
  }
  if (
    normalized === "PERMISSION_DENIED" ||
    lowerMessage.includes("permission denied") ||
    lowerMessage.includes("insufficient permissions")
  ) {
    return new ConnectorSdkError(
      "FORBIDDEN",
      "Google Sheets denied access. Verify OAuth scope and spreadsheet permissions.",
    );
  }
  if (normalized === "NOT_FOUND" || lowerMessage.includes("not found")) {
    return new ConnectorSdkError(
      "NOT_FOUND",
      "Google Sheets resource was not found.",
    );
  }
  if (
    normalized === "RESOURCE_EXHAUSTED" ||
    lowerMessage.includes("quota") ||
    lowerMessage.includes("rate limit")
  ) {
    if (ambiguousWrite) {
      return new ConnectorSdkError("RATE_LIMITED", AMBIGUOUS_WRITE_MESSAGE, {
        retryable: false,
      });
    }
    return rateLimitError("Google Sheets quota or rate limit exceeded.");
  }
  if (
    normalized === "INVALID_ARGUMENT" ||
    lowerMessage.includes("invalid argument")
  ) {
    return new ConnectorSdkError(
      "INVALID_INPUT",
      "Google Sheets rejected the request.",
    );
  }
  return undefined;
}

export function mapSheetsError(
  error: unknown,
  options?: MapSheetsErrorOptions,
): ConnectorSdkError {
  const accessToken = options?.accessToken;
  const ambiguousWrite = options?.ambiguousWrite === true;

  if (error instanceof ConnectorSdkError) {
    return error;
  }

  if (isAbortError(error)) {
    return new ConnectorSdkError("CANCELLED", "Request was cancelled.");
  }

  if (isTimeoutError(error)) {
    if (ambiguousWrite) {
      return new ConnectorSdkError("TIMEOUT", AMBIGUOUS_WRITE_MESSAGE, {
        retryable: false,
      });
    }
    return new ConnectorSdkError(
      "TIMEOUT",
      "Google Sheets request timed out.",
      {
        retryable: true,
      },
    );
  }

  if (
    error !== null &&
    typeof error === "object" &&
    "kind" in error &&
    (error as SheetsHttpError).kind === "http"
  ) {
    const httpError = error as SheetsHttpError & { kind: "http" };
    const mapped = mapGoogleErrorStatus(
      httpError.googleStatus,
      httpError.googleMessage ?? "",
      ambiguousWrite,
    );
    if (mapped !== undefined) {
      return mapped;
    }
    if (httpError.status === 401) {
      return new ConnectorSdkError(
        "UNAUTHORIZED",
        "Google Sheets authentication failed.",
      );
    }
    if (httpError.status === 403) {
      return new ConnectorSdkError(
        "FORBIDDEN",
        "Google Sheets denied access to this resource.",
      );
    }
    if (httpError.status === 404) {
      return new ConnectorSdkError(
        "NOT_FOUND",
        "Google Sheets resource was not found.",
      );
    }
    if (httpError.status === 429) {
      if (ambiguousWrite) {
        return new ConnectorSdkError("RATE_LIMITED", AMBIGUOUS_WRITE_MESSAGE, {
          retryable: false,
        });
      }
      return rateLimitError("Google Sheets rate limit exceeded.");
    }
    if (httpError.status >= 500) {
      if (ambiguousWrite) {
        return new ConnectorSdkError(
          "PROVIDER_ERROR",
          AMBIGUOUS_WRITE_MESSAGE,
          {
            retryable: false,
          },
        );
      }
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Google Sheets is temporarily unavailable.",
        { retryable: true },
      );
    }
  }

  if (ambiguousWrite) {
    return new ConnectorSdkError("PROVIDER_ERROR", AMBIGUOUS_WRITE_MESSAGE, {
      retryable: false,
    });
  }

  if (error instanceof Error) {
    const sanitized = redactSecrets(error.message, accessToken);
    if (sanitized.includes("[REDACTED]") && sanitized.length > 80) {
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        "An unexpected error occurred while contacting Google Sheets.",
      );
    }
  }

  return new ConnectorSdkError(
    "PROVIDER_ERROR",
    "An unexpected error occurred while contacting Google Sheets.",
  );
}
