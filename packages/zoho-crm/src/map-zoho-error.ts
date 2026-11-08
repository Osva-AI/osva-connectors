import { ConnectorSdkError, rateLimitError } from "@osva-ai/connector-sdk";
import { redactZohoSecrets } from "./zoho-auth.js";
import type { ZohoHttpError } from "./zoho-rest-client.js";

export interface MapZohoErrorOptions {
  readonly accessToken?: string;
  readonly ambiguousWrite?: boolean;
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

export function mapZohoError(
  error: unknown,
  options: MapZohoErrorOptions = {},
): ConnectorSdkError {
  if (error instanceof ConnectorSdkError) return error;
  if (isAbortError(error)) {
    return new ConnectorSdkError("CANCELLED", "Request was cancelled.");
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "kind" in error &&
    (error as ZohoHttpError).kind === "http"
  ) {
    const http = error as ZohoHttpError;
    if (http.status === 401) {
      return new ConnectorSdkError(
        "UNAUTHORIZED",
        "Zoho CRM access token is invalid.",
      );
    }
    if (http.status === 403) {
      return new ConnectorSdkError("FORBIDDEN", "Zoho CRM denied access.");
    }
    if (http.status === 404) {
      return new ConnectorSdkError("NOT_FOUND", "Zoho CRM resource not found.");
    }
    if (http.status === 429) {
      return rateLimitError("Zoho CRM rate limit exceeded.");
    }
    if (options.ambiguousWrite === true) {
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Zoho CRM write outcome is ambiguous; verify before retrying.",
      );
    }
    return new ConnectorSdkError(
      "PROVIDER_ERROR",
      redactZohoSecrets(
        `Zoho CRM API error (${http.status}).`,
        options.accessToken,
      ),
    );
  }
  const message =
    error instanceof Error
      ? redactZohoSecrets(error.message, options.accessToken)
      : "Zoho CRM request failed.";
  return new ConnectorSdkError("PROVIDER_ERROR", message);
}
