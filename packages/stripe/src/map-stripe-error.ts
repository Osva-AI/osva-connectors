import { ConnectorSdkError, rateLimitError } from "@osva-ai/connector-sdk";

import type { StripeHttpError } from "./stripe-rest-client.js";

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

function redactSecrets(message: string, apiKey?: string): string {
  let result = message;
  if (apiKey !== undefined && apiKey.length > 0) {
    result = result.split(apiKey).join("[REDACTED]");
  }
  result = result.replace(
    /Bearer\s+(?:sk|rk)_(?:test|live)_[A-Za-z0-9]+/gi,
    "Bearer [REDACTED]",
  );
  return result;
}

function mapStripeErrorDetail(
  code: string | undefined,
  type: string | undefined,
  message: string | undefined,
): ConnectorSdkError | undefined {
  const combined = `${type ?? ""} ${code ?? ""} ${message ?? ""}`.toLowerCase();

  if (
    type === "invalid_request_error" &&
    (combined.includes("no such") || combined.includes("resource_missing"))
  ) {
    return new ConnectorSdkError("NOT_FOUND", "Stripe resource was not found.");
  }
  if (
    type === "authentication_error" ||
    combined.includes("invalid api key") ||
    combined.includes("authentication")
  ) {
    return new ConnectorSdkError(
      "UNAUTHORIZED",
      "Stripe API key is invalid or missing required permissions.",
    );
  }
  if (
    type === "permission_error" ||
    code === "permission_denied" ||
    combined.includes("does not have access") ||
    combined.includes("forbidden")
  ) {
    return new ConnectorSdkError(
      "FORBIDDEN",
      "Stripe denied access. Verify restricted key permissions.",
    );
  }
  if (type === "invalid_request_error" || combined.includes("invalid")) {
    return new ConnectorSdkError(
      "INVALID_INPUT",
      "Stripe rejected the request parameters.",
    );
  }
  if (type === "rate_limit_error" || combined.includes("rate limit")) {
    return rateLimitError("Stripe rate limit exceeded.");
  }
  return undefined;
}

export interface MapStripeErrorOptions {
  readonly apiKey?: string;
}

export function mapStripeError(
  error: unknown,
  options?: MapStripeErrorOptions,
): ConnectorSdkError {
  const apiKey = options?.apiKey;

  if (error instanceof ConnectorSdkError) {
    return error;
  }

  if (isAbortError(error)) {
    return new ConnectorSdkError("CANCELLED", "Request was cancelled.");
  }

  if (isTimeoutError(error)) {
    return new ConnectorSdkError("TIMEOUT", "Stripe request timed out.", {
      retryable: true,
    });
  }

  if (
    error !== null &&
    typeof error === "object" &&
    "kind" in error &&
    (error as StripeHttpError).kind === "http"
  ) {
    const httpError = error as StripeHttpError;
    const mapped = mapStripeErrorDetail(
      httpError.stripeCode,
      httpError.stripeType,
      httpError.stripeMessage,
    );
    if (mapped !== undefined) {
      return mapped;
    }
    if (httpError.status === 401) {
      return new ConnectorSdkError(
        "UNAUTHORIZED",
        "Stripe authentication failed.",
      );
    }
    if (httpError.status === 403) {
      return new ConnectorSdkError(
        "FORBIDDEN",
        "Stripe denied access to this resource.",
      );
    }
    if (httpError.status === 404) {
      return new ConnectorSdkError(
        "NOT_FOUND",
        "Stripe resource was not found.",
      );
    }
    if (httpError.status === 429) {
      return rateLimitError("Stripe rate limit exceeded.");
    }
    if (httpError.status >= 500) {
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Stripe is temporarily unavailable.",
        { retryable: true },
      );
    }
  }

  if (error instanceof Error) {
    const sanitized = redactSecrets(error.message, apiKey);
    if (sanitized.includes("[REDACTED]") && sanitized.length > 80) {
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        "An unexpected error occurred while contacting Stripe.",
      );
    }
  }

  return new ConnectorSdkError(
    "PROVIDER_ERROR",
    "An unexpected error occurred while contacting Stripe.",
  );
}
