import { ConnectorSdkError, rateLimitError } from "@osva-ai/connector-sdk";

import type { WhatsAppGraphHttpError } from "./whatsapp-graph-client.js";

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
  result = result.replace(/\b\d{10,15}\b/g, "[REDACTED_PHONE]");
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
      "WhatsApp access token is invalid or expired.",
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
      "WhatsApp denied access. Verify whatsapp_business_management and whatsapp_business_messaging permissions and asset assignments.",
    );
  }
  if (code === 100 && subcode === 33) {
    return new ConnectorSdkError(
      "NOT_FOUND",
      "WhatsApp object was not found or is not visible to this token.",
    );
  }
  if (code === 100 || lowerMessage.includes("invalid parameter")) {
    return new ConnectorSdkError(
      "INVALID_INPUT",
      "WhatsApp rejected the request parameters.",
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
    return rateLimitError("WhatsApp rate limit or usage cap exceeded.");
  }
  return undefined;
}

export interface MapWhatsAppErrorOptions {
  readonly accessToken?: string;
  readonly ambiguousSend?: boolean;
}

export function mapWhatsAppError(
  error: unknown,
  options?: MapWhatsAppErrorOptions,
): ConnectorSdkError {
  const accessToken = options?.accessToken;
  const ambiguousSend = options?.ambiguousSend === true;

  if (error instanceof ConnectorSdkError) {
    return error;
  }

  if (isAbortError(error)) {
    return new ConnectorSdkError("CANCELLED", "Request was cancelled.");
  }

  if (isTimeoutError(error)) {
    if (ambiguousSend) {
      return new ConnectorSdkError(
        "TIMEOUT",
        "WhatsApp template send timed out. Delivery is indeterminate; verify message status via your webhook integration before retrying.",
      );
    }
    return new ConnectorSdkError("TIMEOUT", "WhatsApp request timed out.", {
      retryable: true,
    });
  }

  if (
    error !== null &&
    typeof error === "object" &&
    "kind" in error &&
    (error as WhatsAppGraphHttpError).kind === "http"
  ) {
    const httpError = error as WhatsAppGraphHttpError;
    const mapped = mapMetaErrorCode(
      httpError.metaCode,
      httpError.metaSubcode,
      httpError.metaMessage ?? "",
    );
    if (mapped !== undefined) {
      if (ambiguousSend) {
        return new ConnectorSdkError(
          mapped.code,
          "WhatsApp template send failed with an ambiguous outcome. Do not retry automatically; verify via webhooks before sending again.",
        );
      }
      return mapped;
    }
    if (httpError.status === 401) {
      return new ConnectorSdkError(
        "UNAUTHORIZED",
        "WhatsApp authentication failed.",
      );
    }
    if (httpError.status === 403) {
      return new ConnectorSdkError(
        "FORBIDDEN",
        "WhatsApp denied access to this business asset.",
      );
    }
    if (httpError.status === 404) {
      return new ConnectorSdkError(
        "NOT_FOUND",
        "WhatsApp resource was not found.",
      );
    }
    if (httpError.status === 429) {
      if (ambiguousSend) {
        return rateLimitError(
          "WhatsApp rate limit exceeded during template send. Do not retry automatically; verify delivery before retrying.",
        );
      }
      return rateLimitError("WhatsApp rate limit exceeded.");
    }
    if (httpError.status >= 500) {
      if (ambiguousSend) {
        return new ConnectorSdkError(
          "PROVIDER_ERROR",
          "WhatsApp template send failed with a server error. Delivery is indeterminate; verify via webhooks before retrying.",
        );
      }
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        "WhatsApp is temporarily unavailable.",
        { retryable: true },
      );
    }
  }

  if (error instanceof Error) {
    const sanitized = redactSecrets(error.message, accessToken);
    if (sanitized.includes("[REDACTED]") && sanitized.length > 80) {
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        "An unexpected error occurred while contacting WhatsApp.",
      );
    }
  }

  if (ambiguousSend) {
    return new ConnectorSdkError(
      "PROVIDER_ERROR",
      "WhatsApp template send failed. Delivery is indeterminate; verify via webhooks before retrying.",
    );
  }

  return new ConnectorSdkError(
    "PROVIDER_ERROR",
    "An unexpected error occurred while contacting WhatsApp.",
  );
}
