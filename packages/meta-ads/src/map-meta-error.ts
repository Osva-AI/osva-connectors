import { ConnectorSdkError, rateLimitError } from "@osva-ai/connector-sdk";

import type { MetaGraphHttpError } from "./meta-graph-client.js";

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
  result = result.replace(
    /access_token=[A-Za-z0-9%._-]+/gi,
    "access_token=[REDACTED]",
  );
  result = result.replace(
    /appsecret_proof=[A-Za-z0-9]+/gi,
    "appsecret_proof=[REDACTED]",
  );
  return result;
}

function mapMetaErrorCode(
  code: number | undefined,
  subcode: number | undefined,
  message: string,
): ConnectorSdkError | undefined {
  const lowerMessage = message.toLowerCase();

  if (
    code === 190 ||
    lowerMessage.includes("expired") ||
    lowerMessage.includes("invalid oauth")
  ) {
    return new ConnectorSdkError(
      "UNAUTHORIZED",
      "Meta Ads access token is invalid or expired.",
    );
  }
  if (
    code === 10 ||
    code === 200 ||
    code === 294 ||
    lowerMessage.includes("permission") ||
    lowerMessage.includes("not authorized")
  ) {
    return new ConnectorSdkError(
      "FORBIDDEN",
      "Meta Ads denied access. Verify ads_read permission, app mode, and ad account assignments.",
    );
  }
  if (code === 100 && subcode === 33) {
    return new ConnectorSdkError(
      "NOT_FOUND",
      "Meta Ads object was not found or is not visible to this token.",
    );
  }
  if (code === 100 || lowerMessage.includes("invalid parameter")) {
    return new ConnectorSdkError(
      "INVALID_INPUT",
      "Meta Ads rejected the request parameters.",
    );
  }
  if (
    code === 4 ||
    code === 17 ||
    code === 32 ||
    code === 613 ||
    lowerMessage.includes("rate limit") ||
    lowerMessage.includes("too many calls")
  ) {
    return rateLimitError("Meta Ads rate limit or usage cap exceeded.");
  }
  return undefined;
}

export interface MapMetaErrorOptions {
  readonly accessToken?: string;
}

export function mapMetaError(
  error: unknown,
  options?: MapMetaErrorOptions,
): ConnectorSdkError {
  const accessToken = options?.accessToken;

  if (error instanceof ConnectorSdkError) {
    return error;
  }

  if (isAbortError(error)) {
    return new ConnectorSdkError("CANCELLED", "Request was cancelled.");
  }

  if (isTimeoutError(error)) {
    return new ConnectorSdkError("TIMEOUT", "Meta Ads request timed out.", {
      retryable: true,
    });
  }

  if (
    error !== null &&
    typeof error === "object" &&
    "kind" in error &&
    (error as MetaGraphHttpError).kind === "http"
  ) {
    const httpError = error as MetaGraphHttpError;
    const mapped = mapMetaErrorCode(
      httpError.metaCode,
      httpError.metaSubcode,
      httpError.metaMessage ?? "",
    );
    if (mapped !== undefined) {
      return mapped;
    }
    if (httpError.status === 401) {
      return new ConnectorSdkError(
        "UNAUTHORIZED",
        "Meta Ads authentication failed.",
      );
    }
    if (httpError.status === 403) {
      return new ConnectorSdkError(
        "FORBIDDEN",
        "Meta Ads denied access to this ad account or resource.",
      );
    }
    if (httpError.status === 404) {
      return new ConnectorSdkError(
        "NOT_FOUND",
        "Meta Ads resource was not found.",
      );
    }
    if (httpError.status === 429) {
      return rateLimitError("Meta Ads rate limit exceeded.");
    }
    if (httpError.status >= 500) {
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Meta Ads is temporarily unavailable.",
        { retryable: true },
      );
    }
  }

  if (error instanceof Error) {
    const sanitized = redactSecrets(error.message, accessToken);
    if (sanitized.includes("[REDACTED]") && sanitized.length > 80) {
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        "An unexpected error occurred while contacting Meta Ads.",
      );
    }
  }

  return new ConnectorSdkError(
    "PROVIDER_ERROR",
    "An unexpected error occurred while contacting Meta Ads.",
  );
}
