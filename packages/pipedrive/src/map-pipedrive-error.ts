import { ConnectorSdkError, rateLimitError } from "@osva-ai/connector-sdk";
import { redactPipedriveSecrets } from "./pipedrive-auth.js";
import type { PipedriveHttpError } from "./pipedrive-rest-client.js";

export interface MapPipedriveErrorOptions {
  readonly apiToken?: string;
  readonly ambiguousWrite?: boolean;
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

export function mapPipedriveError(
  error: unknown,
  options: MapPipedriveErrorOptions = {},
): ConnectorSdkError {
  if (error instanceof ConnectorSdkError) return error;
  if (isAbortError(error)) {
    return new ConnectorSdkError("CANCELLED", "Request was cancelled.");
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "kind" in error &&
    (error as PipedriveHttpError).kind === "http"
  ) {
    const http = error as PipedriveHttpError;
    if (http.status === 401) {
      return new ConnectorSdkError(
        "UNAUTHORIZED",
        "Pipedrive API credentials are invalid.",
      );
    }
    if (http.status === 403) {
      return new ConnectorSdkError("FORBIDDEN", "Pipedrive denied access.");
    }
    if (http.status === 404) {
      return new ConnectorSdkError(
        "NOT_FOUND",
        "Pipedrive resource not found.",
      );
    }
    if (http.status === 429) {
      return rateLimitError("Pipedrive rate limit exceeded.");
    }
    if (options.ambiguousWrite === true) {
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Pipedrive write outcome is ambiguous; verify before retrying.",
      );
    }
    return new ConnectorSdkError(
      "PROVIDER_ERROR",
      redactPipedriveSecrets(
        `Pipedrive API error (${http.status}).`,
        options.apiToken,
      ),
    );
  }
  const message =
    error instanceof Error
      ? redactPipedriveSecrets(error.message, options.apiToken)
      : "Pipedrive request failed.";
  return new ConnectorSdkError("PROVIDER_ERROR", message);
}
