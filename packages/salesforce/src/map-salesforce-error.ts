import { ConnectorSdkError, rateLimitError } from "@osva-ai/connector-sdk";
import { redactSalesforceSecrets } from "./salesforce-auth.js";
import type { SalesforceHttpError } from "./salesforce-rest-client.js";

export interface MapSalesforceErrorOptions {
  readonly accessToken?: string;
  readonly ambiguousWrite?: boolean;
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

export function mapSalesforceError(
  error: unknown,
  options: MapSalesforceErrorOptions = {},
): ConnectorSdkError {
  if (error instanceof ConnectorSdkError) return error;
  if (isAbortError(error)) {
    return new ConnectorSdkError("CANCELLED", "Request was cancelled.");
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "kind" in error &&
    (error as SalesforceHttpError).kind === "http"
  ) {
    const http = error as SalesforceHttpError;
    if (http.status === 401) {
      return new ConnectorSdkError(
        "UNAUTHORIZED",
        "Salesforce access token is invalid.",
      );
    }
    if (http.status === 403) {
      return new ConnectorSdkError("FORBIDDEN", "Salesforce denied access.");
    }
    if (http.status === 404) {
      return new ConnectorSdkError(
        "NOT_FOUND",
        "Salesforce resource not found.",
      );
    }
    if (http.status === 429) {
      return rateLimitError("Salesforce rate limit exceeded.");
    }
    if (options.ambiguousWrite === true) {
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Salesforce write outcome is ambiguous; verify before retrying.",
      );
    }
    return new ConnectorSdkError(
      "PROVIDER_ERROR",
      redactSalesforceSecrets(
        `Salesforce API error (${http.status}).`,
        options.accessToken,
      ),
    );
  }
  const message =
    error instanceof Error
      ? redactSalesforceSecrets(error.message, options.accessToken)
      : "Salesforce request failed.";
  return new ConnectorSdkError("PROVIDER_ERROR", message);
}
