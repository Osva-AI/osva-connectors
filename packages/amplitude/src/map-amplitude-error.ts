import { ConnectorSdkError, rateLimitError } from "@osva-ai/connector-sdk";

import type { AmplitudeHttpError } from "./amplitude-rest-client.js";

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

function redactSecrets(
  message: string,
  apiKey?: string,
  secretKey?: string,
): string {
  let result = message;
  if (apiKey !== undefined && apiKey.length > 0) {
    result = result.split(apiKey).join("[REDACTED]");
  }
  if (secretKey !== undefined && secretKey.length > 0) {
    result = result.split(secretKey).join("[REDACTED]");
  }
  result = result.replace(/Basic\s+[A-Za-z0-9+/=]+/gi, "Basic [REDACTED]");
  return result;
}

export interface MapAmplitudeErrorOptions {
  readonly apiKey?: string;
  readonly secretKey?: string;
}

export function mapAmplitudeError(
  error: unknown,
  options?: MapAmplitudeErrorOptions,
): ConnectorSdkError {
  const apiKey = options?.apiKey;
  const secretKey = options?.secretKey;

  if (error instanceof ConnectorSdkError) {
    return error;
  }

  if (isAbortError(error)) {
    return new ConnectorSdkError("CANCELLED", "Request was cancelled.");
  }

  if (isTimeoutError(error)) {
    return new ConnectorSdkError("TIMEOUT", "Amplitude request timed out.", {
      retryable: true,
    });
  }

  if (
    error !== null &&
    typeof error === "object" &&
    "kind" in error &&
    (error as AmplitudeHttpError).kind === "http"
  ) {
    const httpError = error as AmplitudeHttpError;
    const bodyMessage = `${httpError.amplitudeMessage ?? ""}`.toLowerCase();
    if (httpError.status === 401) {
      return new ConnectorSdkError(
        "UNAUTHORIZED",
        "Amplitude API key or secret key is invalid.",
      );
    }
    if (httpError.status === 403) {
      return new ConnectorSdkError(
        "FORBIDDEN",
        "Amplitude denied access. Verify project credentials and permissions.",
      );
    }
    if (httpError.status === 404) {
      return new ConnectorSdkError(
        "NOT_FOUND",
        "Amplitude resource was not found.",
      );
    }
    if (httpError.status === 400 || bodyMessage.includes("invalid")) {
      return new ConnectorSdkError(
        "INVALID_INPUT",
        "Amplitude rejected the request parameters.",
      );
    }
    if (httpError.status === 429) {
      return rateLimitError("Amplitude rate limit exceeded.");
    }
    if (httpError.status >= 500) {
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Amplitude is temporarily unavailable.",
        { retryable: true },
      );
    }
  }

  if (error instanceof Error) {
    const sanitized = redactSecrets(error.message, apiKey, secretKey);
    if (sanitized.includes("[REDACTED]") && sanitized.length > 80) {
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        "An unexpected error occurred while contacting Amplitude.",
      );
    }
  }

  return new ConnectorSdkError(
    "PROVIDER_ERROR",
    "An unexpected error occurred while contacting Amplitude.",
  );
}
