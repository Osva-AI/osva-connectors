import { ConnectorSdkError, rateLimitError } from "@osva-ai/connector-sdk";
import { redactFreshdeskSecrets } from "./freshdesk-auth.js";
import type { FreshdeskHttpError } from "./freshdesk-rest-client.js";

export interface MapFreshdeskErrorOptions {
  readonly apiKey?: string;
  readonly ambiguousWrite?: boolean;
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

export function mapFreshdeskError(
  error: unknown,
  options: MapFreshdeskErrorOptions = {},
): ConnectorSdkError {
  if (error instanceof ConnectorSdkError) return error;
  if (isAbortError(error)) {
    return new ConnectorSdkError("CANCELLED", "Request was cancelled.");
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "kind" in error &&
    (error as FreshdeskHttpError).kind === "http"
  ) {
    const http = error as FreshdeskHttpError;
    if (http.status === 401) {
      return new ConnectorSdkError(
        "UNAUTHORIZED",
        "Freshdesk API credentials are invalid.",
      );
    }
    if (http.status === 403) {
      return new ConnectorSdkError("FORBIDDEN", "Freshdesk denied access.");
    }
    if (http.status === 404) {
      return new ConnectorSdkError(
        "NOT_FOUND",
        "Freshdesk resource not found.",
      );
    }
    if (http.status === 429) {
      return rateLimitError("Freshdesk rate limit exceeded.");
    }
    if (options.ambiguousWrite === true) {
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Freshdesk write outcome is ambiguous; verify before retrying.",
      );
    }
    return new ConnectorSdkError(
      "PROVIDER_ERROR",
      redactFreshdeskSecrets(
        `Freshdesk API error (${http.status}).`,
        options.apiKey,
      ),
    );
  }
  const message =
    error instanceof Error
      ? redactFreshdeskSecrets(error.message, options.apiKey)
      : "Freshdesk request failed.";
  return new ConnectorSdkError("PROVIDER_ERROR", message);
}
