import { ConnectorSdkError, rateLimitError } from "@osva-ai/connector-sdk";

import type { MixpanelHttpError } from "./mixpanel-rest-client.js";

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
  options?: MapMixpanelErrorOptions,
): string {
  let result = message;
  const username = options?.serviceAccountUsername;
  const secret = options?.serviceAccountSecret;
  if (username !== undefined && username.length > 0) {
    result = result.split(username).join("[REDACTED]");
  }
  if (secret !== undefined && secret.length > 0) {
    result = result.split(secret).join("[REDACTED]");
  }
  result = result.replace(/Basic\s+[A-Za-z0-9+/=]+/gi, "Basic [REDACTED]");
  result = result.replace(
    /Authorization:\s*Basic\s+[A-Za-z0-9+/=]+/gi,
    "Authorization: Basic [REDACTED]",
  );
  return result;
}

function mapMixpanelErrorBody(
  status: number,
  message: string | undefined,
): ConnectorSdkError | undefined {
  const combined = (message ?? "").toLowerCase();

  if (status === 401 || combined.includes("unauthorized")) {
    return new ConnectorSdkError(
      "UNAUTHORIZED",
      "Mixpanel service account authentication failed.",
    );
  }
  if (status === 403 || combined.includes("forbidden")) {
    return new ConnectorSdkError("FORBIDDEN", "Mixpanel denied access.");
  }
  if (status === 404 || combined.includes("not found")) {
    return new ConnectorSdkError(
      "NOT_FOUND",
      "Mixpanel resource was not found.",
    );
  }
  if (status === 400 || combined.includes("invalid")) {
    return new ConnectorSdkError(
      "INVALID_INPUT",
      "Mixpanel rejected the request parameters.",
    );
  }
  if (
    status === 429 ||
    combined.includes("rate limit") ||
    combined.includes("too many")
  ) {
    return rateLimitError("Mixpanel rate limit exceeded.");
  }
  return undefined;
}

export interface MapMixpanelErrorOptions {
  readonly serviceAccountUsername?: string;
  readonly serviceAccountSecret?: string;
}

export function mapMixpanelError(
  error: unknown,
  options?: MapMixpanelErrorOptions,
): ConnectorSdkError {
  if (error instanceof ConnectorSdkError) {
    return error;
  }

  if (isAbortError(error)) {
    return new ConnectorSdkError(
      "CANCELLED",
      "Mixpanel request was cancelled.",
    );
  }

  if (isTimeoutError(error)) {
    return new ConnectorSdkError("TIMEOUT", "Mixpanel request timed out.", {
      retryable: true,
    });
  }

  if (
    error !== null &&
    typeof error === "object" &&
    "kind" in error &&
    (error as MixpanelHttpError).kind === "http"
  ) {
    const http = error as MixpanelHttpError;
    const mapped = mapMixpanelErrorBody(http.status, http.mixpanelMessage);
    if (mapped !== undefined) {
      return mapped;
    }
    if (http.status >= 500) {
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Mixpanel is temporarily unavailable.",
        { retryable: true },
      );
    }
  }

  if (error instanceof Error) {
    const sanitized = redactSecrets(error.message, options);
    if (sanitized.includes("[REDACTED]") && sanitized.length > 80) {
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        "An unexpected error occurred while contacting Mixpanel.",
      );
    }
  }

  return new ConnectorSdkError(
    "PROVIDER_ERROR",
    "An unexpected error occurred while contacting Mixpanel.",
  );
}
