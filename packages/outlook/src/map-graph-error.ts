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

function mapGraphErrorBody(
  code: string | undefined,
  message: string,
  ambiguousMutation: boolean,
): ConnectorSdkError | undefined {
  const normalized = (code ?? "").toLowerCase();
  const lowerMessage = message.toLowerCase();

  if (
    normalized === "invalidauthenticationtoken" ||
    lowerMessage.includes("invalid token") ||
    lowerMessage.includes("unauthorized")
  ) {
    return new ConnectorSdkError(
      "UNAUTHORIZED",
      "Microsoft Graph authentication failed.",
    );
  }
  if (
    normalized === "accessdenied" ||
    normalized === "authorization_requestdenied" ||
    lowerMessage.includes("access denied") ||
    lowerMessage.includes("insufficient privileges")
  ) {
    return new ConnectorSdkError(
      "FORBIDDEN",
      "Microsoft Graph denied access. Verify delegated permissions.",
    );
  }
  if (normalized === "itemnotfound" || lowerMessage.includes("not found")) {
    return new ConnectorSdkError(
      "NOT_FOUND",
      "Microsoft Graph resource was not found.",
    );
  }
  if (
    normalized === "activitylimitreached" ||
    lowerMessage.includes("throttl") ||
    lowerMessage.includes("rate limit")
  ) {
    if (ambiguousMutation) {
      return new ConnectorSdkError(
        "RATE_LIMITED",
        "Microsoft Graph rate limit may have been hit; mutations are non-idempotent — verify before retrying.",
        { retryable: false },
      );
    }
    return rateLimitError("Microsoft Graph quota or rate limit exceeded.");
  }
  if (normalized === "badrequest" || lowerMessage.includes("bad request")) {
    return new ConnectorSdkError(
      "INVALID_INPUT",
      "Microsoft Graph rejected the request.",
    );
  }
  return undefined;
}

const AMBIGUOUS_MUTATION_MESSAGE =
  "Microsoft Graph did not return a confirmable response. The operation may still have succeeded; verify before retrying.";

export interface MapGraphErrorOptions {
  readonly accessToken?: string;
  readonly ambiguousMutation?: boolean;
}

export function mapGraphError(
  error: unknown,
  options?: MapGraphErrorOptions,
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
      return new ConnectorSdkError("TIMEOUT", AMBIGUOUS_MUTATION_MESSAGE, {
        retryable: false,
      });
    }
    return new ConnectorSdkError(
      "TIMEOUT",
      "Microsoft Graph request timed out.",
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
    const mapped = mapGraphErrorBody(
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
        "Microsoft Graph authentication failed.",
      );
    }
    if (httpError.status === 403) {
      return new ConnectorSdkError(
        "FORBIDDEN",
        "Microsoft Graph denied access to this resource.",
      );
    }
    if (httpError.status === 404) {
      return new ConnectorSdkError(
        "NOT_FOUND",
        "Microsoft Graph resource was not found.",
      );
    }
    if (httpError.status === 429) {
      if (ambiguousMutation) {
        return new ConnectorSdkError(
          "RATE_LIMITED",
          AMBIGUOUS_MUTATION_MESSAGE,
          { retryable: false },
        );
      }
      return rateLimitError("Microsoft Graph rate limit exceeded.");
    }
    if (httpError.status >= 500) {
      if (ambiguousMutation) {
        return new ConnectorSdkError(
          "PROVIDER_ERROR",
          AMBIGUOUS_MUTATION_MESSAGE,
          { retryable: false },
        );
      }
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Microsoft Graph is temporarily unavailable.",
        { retryable: true },
      );
    }
  }

  if (ambiguousMutation) {
    return new ConnectorSdkError("PROVIDER_ERROR", AMBIGUOUS_MUTATION_MESSAGE, {
      retryable: false,
    });
  }

  if (error instanceof Error) {
    const sanitized = redactSecrets(error.message, accessToken);
    if (sanitized.includes("[REDACTED]") && sanitized.length > 80) {
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        "An unexpected error occurred while contacting Microsoft Graph.",
      );
    }
  }

  return new ConnectorSdkError(
    "PROVIDER_ERROR",
    "An unexpected error occurred while contacting Microsoft Graph.",
  );
}
