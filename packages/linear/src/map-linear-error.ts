import { ConnectorSdkError, rateLimitError } from "@osva-ai/connector-sdk";

import type {
  LinearGraphqlError,
  LinearHttpError,
} from "./linear-graphql-client.js";

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

function redactSecrets(message: string, credential?: string): string {
  let result = message;
  if (credential !== undefined && credential.length > 0) {
    result = result.split(credential).join("[REDACTED]");
  }
  result = result.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]");
  result = result.replace(/lin_api_[A-Za-z0-9]+/gi, "lin_api_[REDACTED]");
  return result;
}

function mapGraphqlMessages(
  messages: readonly string[],
  extensionsCodes: readonly (string | undefined)[],
  credential?: string,
): ConnectorSdkError | undefined {
  const combined =
    `${messages.join(" ")} ${extensionsCodes.join(" ")}`.toLowerCase();

  if (
    combined.includes("authentication") ||
    combined.includes("unauthorized") ||
    combined.includes("invalid api key")
  ) {
    return new ConnectorSdkError(
      "UNAUTHORIZED",
      "Linear API credentials are invalid or expired.",
    );
  }
  if (
    combined.includes("forbidden") ||
    combined.includes("not authorized") ||
    combined.includes("access denied")
  ) {
    return new ConnectorSdkError(
      "FORBIDDEN",
      "Linear denied access. Verify token scopes and workspace membership.",
    );
  }
  if (combined.includes("not found") || combined.includes("could not find")) {
    return new ConnectorSdkError("NOT_FOUND", "Linear resource was not found.");
  }
  if (
    combined.includes("rate limit") ||
    combined.includes("ratelimit") ||
    combined.includes("throttl")
  ) {
    return rateLimitError("Linear rate limit exceeded.");
  }
  if (
    combined.includes("invalid") ||
    combined.includes("validation") ||
    combined.includes("argument")
  ) {
    const safe = redactSecrets(messages[0] ?? "Invalid request.", credential);
    return new ConnectorSdkError(
      "INVALID_INPUT",
      safe.length > 200 ? "Linear rejected the request parameters." : safe,
    );
  }
  return undefined;
}

export function mapLinearError(
  error: unknown,
  options?: {
    readonly credential?: string;
    readonly ambiguousWrite?: boolean;
  },
): ConnectorSdkError {
  if (error instanceof ConnectorSdkError) {
    return error;
  }
  if (isAbortError(error)) {
    return new ConnectorSdkError("CANCELLED", "Linear request was cancelled.");
  }
  if (isTimeoutError(error)) {
    return new ConnectorSdkError(
      "TIMEOUT",
      "Linear request timed out.",
      options?.ambiguousWrite === true ? { retryable: false } : undefined,
    );
  }

  if (
    error !== null &&
    typeof error === "object" &&
    "kind" in error &&
    (error as LinearHttpError).kind === "http"
  ) {
    const httpError = error as LinearHttpError;
    if (httpError.status === 401) {
      return new ConnectorSdkError(
        "UNAUTHORIZED",
        "Linear API credentials are invalid or expired.",
      );
    }
    if (httpError.status === 403) {
      return new ConnectorSdkError(
        "FORBIDDEN",
        "Linear denied access to this resource.",
      );
    }
    if (httpError.status === 429) {
      return rateLimitError("Linear rate limit exceeded.");
    }
    if (httpError.status >= 500) {
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Linear service error.",
        options?.ambiguousWrite === true ? { retryable: false } : undefined,
      );
    }
    const safeMessage = redactSecrets(
      httpError.message ?? "Linear request failed.",
      options?.credential,
    );
    return new ConnectorSdkError("PROVIDER_ERROR", safeMessage, {
      retryable: false,
    });
  }

  if (
    error !== null &&
    typeof error === "object" &&
    "kind" in error &&
    (error as LinearGraphqlError).kind === "graphql"
  ) {
    const gqlError = error as LinearGraphqlError;
    if (gqlError.rateLimited === true) {
      return rateLimitError("Linear rate limit exceeded.");
    }
    const mapped = mapGraphqlMessages(
      gqlError.messages,
      gqlError.extensionCodes,
      options?.credential,
    );
    if (mapped !== undefined) {
      return mapped;
    }
    const safe = redactSecrets(
      gqlError.messages[0] ?? "Linear GraphQL request failed.",
      options?.credential,
    );
    return new ConnectorSdkError(
      "PROVIDER_ERROR",
      safe.length > 200 ? "Linear rejected the GraphQL request." : safe,
      options?.ambiguousWrite === true ? { retryable: false } : undefined,
    );
  }

  if (error instanceof Error) {
    return new ConnectorSdkError(
      "PROVIDER_ERROR",
      redactSecrets(error.message, options?.credential),
      options?.ambiguousWrite === true ? { retryable: false } : undefined,
    );
  }

  return new ConnectorSdkError(
    "PROVIDER_ERROR",
    "Linear request failed.",
    options?.ambiguousWrite === true ? { retryable: false } : undefined,
  );
}
