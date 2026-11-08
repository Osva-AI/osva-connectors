import { ConnectorSdkError, rateLimitError } from "@osva-ai/connector-sdk";
import { redactZendeskSecrets } from "./zendesk-auth.js";
import type { ZendeskHttpError } from "./zendesk-rest-client.js";

export interface MapZendeskErrorOptions {
  readonly email?: string;
  readonly apiToken?: string;
  readonly ambiguousWrite?: boolean;
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const code = (error as Error & { code?: string }).code;
  return (
    error.name === "TimeoutError" ||
    error.message.includes("timed out") ||
    code === "ETIMEDOUT"
  );
}

function mapHttpStatus(status: number): ConnectorSdkError | undefined {
  if (status === 401) {
    return new ConnectorSdkError(
      "UNAUTHORIZED",
      "Zendesk API credentials are invalid.",
    );
  }
  if (status === 403) {
    return new ConnectorSdkError("FORBIDDEN", "Zendesk denied access.");
  }
  if (status === 404) {
    return new ConnectorSdkError(
      "NOT_FOUND",
      "Zendesk resource was not found.",
    );
  }
  if (status === 409) {
    return new ConnectorSdkError(
      "CONFLICT",
      "Zendesk safe-update conflict; re-read the ticket before retrying.",
    );
  }
  if (status === 400 || status === 422) {
    return new ConnectorSdkError(
      "INVALID_INPUT",
      "Zendesk rejected the request parameters.",
    );
  }
  if (status === 429) {
    return rateLimitError("Zendesk rate limit exceeded.");
  }
  return undefined;
}

export function mapZendeskError(
  error: unknown,
  options: MapZendeskErrorOptions = {},
): ConnectorSdkError {
  if (error instanceof ConnectorSdkError) {
    return error;
  }
  if (isAbortError(error)) {
    return new ConnectorSdkError("CANCELLED", "Request was cancelled.");
  }
  if (isTimeoutError(error)) {
    return new ConnectorSdkError("TIMEOUT", "Zendesk request timed out.");
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "kind" in error &&
    (error as ZendeskHttpError).kind === "http"
  ) {
    const http = error as ZendeskHttpError;
    const mapped = mapHttpStatus(http.status);
    if (mapped !== undefined) {
      return mapped;
    }
    if (options.ambiguousWrite === true) {
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Zendesk write outcome is ambiguous; verify before retrying.",
      );
    }
    return new ConnectorSdkError(
      "PROVIDER_ERROR",
      redactZendeskSecrets(
        `Zendesk API error (${http.status}).`,
        options.email,
        options.apiToken,
      ),
    );
  }
  const message =
    error instanceof Error
      ? redactZendeskSecrets(error.message, options.email, options.apiToken)
      : "Zendesk request failed.";
  return new ConnectorSdkError("PROVIDER_ERROR", message);
}
