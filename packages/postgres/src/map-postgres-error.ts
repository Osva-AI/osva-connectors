import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import type { DatabaseError } from "pg";

const SECRET_PATTERNS = [
  /postgres(?:ql)?:\/\/[^\s"'`]+/gi,
  /password[=:]\S+/gi,
];

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }
  return error instanceof Error && error.name === "AbortError";
}

function isDatabaseError(error: unknown): error is DatabaseError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as DatabaseError).code === "string"
  );
}

function isTimeoutError(error: unknown): boolean {
  const code = (error as Error & { code?: string }).code;
  if (code === "57014") {
    return true;
  }
  return (
    code === "ETIMEDOUT" || code === "ESOCKETTIMEDOUT" || code === "ECONNRESET"
  );
}

function isTlsVerificationError(error: unknown): boolean {
  const code = (error as Error & { code?: string }).code;
  return (
    code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
    code === "DEPTH_ZERO_SELF_SIGNED_CERT" ||
    code === "SELF_SIGNED_CERT_IN_CHAIN" ||
    code === "ERR_TLS_CERT_ALTNAME_INVALID"
  );
}

function isConnectionRefused(error: unknown): boolean {
  return (error as Error & { code?: string }).code === "ECONNREFUSED";
}

export function sanitizeErrorMessage(message: string): string {
  let sanitized = message;
  for (const pattern of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[redacted]");
  }
  return sanitized;
}

export function mapPostgresError(error: unknown): ConnectorSdkError {
  if (error instanceof ConnectorSdkError) {
    return error;
  }

  if (isAbortError(error)) {
    return new ConnectorSdkError("CANCELLED", "Request was cancelled.");
  }

  if (isTimeoutError(error)) {
    return new ConnectorSdkError("TIMEOUT", "PostgreSQL request timed out.", {
      retryable: true,
    });
  }

  if (isConnectionRefused(error)) {
    return new ConnectorSdkError(
      "PROVIDER_ERROR",
      "PostgreSQL database is unreachable.",
      { retryable: true },
    );
  }

  if (isTlsVerificationError(error)) {
    return new ConnectorSdkError(
      "PROVIDER_ERROR",
      "PostgreSQL TLS connection could not be verified.",
      { retryable: false },
    );
  }

  if (isDatabaseError(error)) {
    if (error.code === "42501") {
      return new ConnectorSdkError(
        "FORBIDDEN",
        "PostgreSQL denied permission for this query.",
      );
    }
    if (error.code === "25006") {
      return new ConnectorSdkError(
        "INVALID_INPUT",
        "Write operations are not permitted in read-only query mode.",
      );
    }
    if (error.code === "55P03") {
      return new ConnectorSdkError("TIMEOUT", "PostgreSQL lock timeout.", {
        retryable: true,
      });
    }
    if (error.code === "28P01") {
      return new ConnectorSdkError(
        "UNAUTHORIZED",
        "PostgreSQL authentication failed.",
      );
    }
    if (error.code === "3D000") {
      return new ConnectorSdkError(
        "NOT_FOUND",
        "PostgreSQL database was not found.",
      );
    }
    if (error.code === "53300") {
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        "PostgreSQL connection limit exceeded.",
        { retryable: true },
      );
    }
  }

  return new ConnectorSdkError(
    "PROVIDER_ERROR",
    "An unexpected error occurred while contacting PostgreSQL.",
  );
}
