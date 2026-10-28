import { ConnectorSdkError, rateLimitError } from "@osva-ai/connector-sdk";

import type { HubspotHttpError } from "./hubspot-rest-client.js";

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

function mapHubspotErrorDetail(
  category: string | undefined,
  message: string | undefined,
): ConnectorSdkError | undefined {
  const combined = `${category ?? ""} ${message ?? ""}`.toLowerCase();

  if (
    combined.includes("invalid authentication") ||
    combined.includes("authentication credentials") ||
    combined.includes("oauth")
  ) {
    return new ConnectorSdkError(
      "UNAUTHORIZED",
      "HubSpot access token is invalid or expired.",
    );
  }
  if (
    combined.includes("forbidden") ||
    combined.includes("missing scopes") ||
    combined.includes("access denied")
  ) {
    return new ConnectorSdkError(
      "FORBIDDEN",
      "HubSpot denied access. Verify token scopes and account permissions.",
    );
  }
  if (combined.includes("not found") || combined.includes("does not exist")) {
    return new ConnectorSdkError(
      "NOT_FOUND",
      "HubSpot resource was not found.",
    );
  }
  if (combined.includes("invalid") || combined.includes("bad request")) {
    return new ConnectorSdkError(
      "INVALID_INPUT",
      "HubSpot rejected the request parameters.",
    );
  }
  if (
    combined.includes("rate limit") ||
    combined.includes("too many requests") ||
    combined.includes("ten_secondly")
  ) {
    return rateLimitError("HubSpot rate limit exceeded.");
  }
  return undefined;
}

export interface MapHubspotErrorOptions {
  readonly accessToken?: string;
}

export function mapHubspotError(
  error: unknown,
  options?: MapHubspotErrorOptions,
): ConnectorSdkError {
  const accessToken = options?.accessToken;

  if (error instanceof ConnectorSdkError) {
    return error;
  }

  if (isAbortError(error)) {
    return new ConnectorSdkError("CANCELLED", "Request was cancelled.");
  }

  if (isTimeoutError(error)) {
    return new ConnectorSdkError("TIMEOUT", "HubSpot request timed out.", {
      retryable: true,
    });
  }

  if (
    error !== null &&
    typeof error === "object" &&
    "kind" in error &&
    (error as HubspotHttpError).kind === "http"
  ) {
    const httpError = error as HubspotHttpError;
    const mapped = mapHubspotErrorDetail(
      httpError.hubspotCategory,
      httpError.hubspotMessage,
    );
    if (mapped !== undefined) {
      return mapped;
    }
    if (httpError.status === 401) {
      return new ConnectorSdkError(
        "UNAUTHORIZED",
        "HubSpot authentication failed.",
      );
    }
    if (httpError.status === 403) {
      return new ConnectorSdkError(
        "FORBIDDEN",
        "HubSpot denied access to this resource.",
      );
    }
    if (httpError.status === 404) {
      return new ConnectorSdkError(
        "NOT_FOUND",
        "HubSpot resource was not found.",
      );
    }
    if (httpError.status === 429) {
      return rateLimitError("HubSpot rate limit exceeded.");
    }
    if (httpError.status >= 500) {
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        "HubSpot is temporarily unavailable.",
        { retryable: true },
      );
    }
  }

  if (error instanceof Error) {
    const sanitized = redactSecrets(error.message, accessToken);
    if (sanitized.includes("[REDACTED]") && sanitized.length > 80) {
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        "An unexpected error occurred while contacting HubSpot.",
      );
    }
  }

  return new ConnectorSdkError(
    "PROVIDER_ERROR",
    "An unexpected error occurred while contacting HubSpot.",
  );
}
