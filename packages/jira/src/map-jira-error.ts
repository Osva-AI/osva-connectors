import { ConnectorSdkError, rateLimitError } from "@osva-ai/connector-sdk";

import type { JiraHttpError } from "./jira-rest-client.js";

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

function redactSecrets(message: string, credential?: string): string {
  let result = message;
  if (credential !== undefined && credential.length > 0) {
    result = result.split(credential).join("[REDACTED]");
  }
  result = result.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]");
  result = result.replace(/Basic\s+[A-Za-z0-9+/=]+/gi, "Basic [REDACTED]");
  return result;
}

function mapJiraErrorBody(
  status: number,
  messages: readonly string[] | undefined,
): ConnectorSdkError | undefined {
  const combined = (messages ?? []).join(" ").toLowerCase();

  if (status === 401 || combined.includes("unauthorized")) {
    return new ConnectorSdkError(
      "UNAUTHORIZED",
      "Jira credentials are invalid or expired.",
    );
  }
  if (status === 403 || combined.includes("forbidden")) {
    return new ConnectorSdkError(
      "FORBIDDEN",
      "Jira denied access. Verify scopes and project permissions.",
    );
  }
  if (status === 404 || combined.includes("not found")) {
    return new ConnectorSdkError(
      "NOT_FOUND",
      "Jira resource was not found or is not accessible.",
    );
  }
  if (status === 400) {
    return new ConnectorSdkError(
      "INVALID_INPUT",
      "Jira rejected the request parameters.",
    );
  }
  if (status === 429 || combined.includes("rate limit")) {
    return rateLimitError("Jira rate limit exceeded.");
  }
  return undefined;
}

export function mapJiraError(
  error: unknown,
  options?: {
    readonly credential?: string;
    readonly ambiguousWrite?: boolean;
  },
): ConnectorSdkError {
  if (error instanceof ConnectorSdkError) {
    return error;
  }
  if (isAbortError(error)) {
    return new ConnectorSdkError("CANCELLED", "Jira request was cancelled.");
  }
  if (isTimeoutError(error)) {
    return new ConnectorSdkError(
      "TIMEOUT",
      "Jira request timed out.",
      options?.ambiguousWrite === true ? { retryable: false } : undefined,
    );
  }

  if (
    error !== null &&
    typeof error === "object" &&
    "kind" in error &&
    (error as JiraHttpError).kind === "http"
  ) {
    const httpError = error as JiraHttpError;
    const mapped = mapJiraErrorBody(
      httpError.status,
      httpError.jiraErrorMessages,
    );
    if (mapped !== undefined) {
      return mapped;
    }
    if (httpError.status >= 500) {
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Jira service error.",
        options?.ambiguousWrite === true ? { retryable: false } : undefined,
      );
    }
    const message =
      httpError.jiraErrorMessages?.join(" ") ?? "Jira request failed.";
    return new ConnectorSdkError(
      "PROVIDER_ERROR",
      redactSecrets(message, options?.credential),
      { retryable: false },
    );
  }

  if (error instanceof Error) {
    return new ConnectorSdkError(
      "PROVIDER_ERROR",
      redactSecrets(error.message, options?.credential),
      options?.ambiguousWrite === true ? { retryable: false } : undefined,
    );
  }

  return new ConnectorSdkError(
    "PROVIDER_ERROR",
    "Jira request failed.",
    options?.ambiguousWrite === true ? { retryable: false } : undefined,
  );
}
