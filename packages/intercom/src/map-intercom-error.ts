import { ConnectorSdkError, rateLimitError } from "@osva-ai/connector-sdk";
import { redactIntercomSecrets } from "./intercom-auth.js";
import type { IntercomHttpError } from "./intercom-rest-client.js";

export interface MapIntercomErrorOptions {
  readonly accessToken?: string;
  readonly ambiguousWrite?: boolean;
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

export function mapIntercomError(
  error: unknown,
  options: MapIntercomErrorOptions = {},
): ConnectorSdkError {
  if (error instanceof ConnectorSdkError) return error;
  if (isAbortError(error)) {
    return new ConnectorSdkError(
      "CANCELLED",
      "Request was cancelled.",
      options.ambiguousWrite === true ? { retryable: false } : undefined,
    );
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "kind" in error &&
    (error as IntercomHttpError).kind === "http"
  ) {
    const http = error as IntercomHttpError;
    if (http.status === 401) {
      return new ConnectorSdkError(
        "UNAUTHORIZED",
        "Intercom access token is invalid.",
      );
    }
    if (http.status === 403) {
      return new ConnectorSdkError("FORBIDDEN", "Intercom denied access.");
    }
    if (http.status === 404) {
      return new ConnectorSdkError("NOT_FOUND", "Intercom resource not found.");
    }
    if (http.status === 429) {
      return rateLimitError("Intercom rate limit exceeded.");
    }
    if (options.ambiguousWrite === true) {
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Intercom write outcome is ambiguous; verify before retrying.",
      );
    }
    return new ConnectorSdkError(
      "PROVIDER_ERROR",
      redactIntercomSecrets(
        `Intercom API error (${http.status}).`,
        options.accessToken,
      ),
    );
  }
  const message =
    error instanceof Error
      ? redactIntercomSecrets(error.message, options.accessToken)
      : "Intercom request failed.";
  return new ConnectorSdkError("PROVIDER_ERROR", message);
}
