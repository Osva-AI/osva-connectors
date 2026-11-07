import { ConnectorSdkError, rateLimitError } from "@osva-ai/connector-sdk";

import type { QdrantHttpError } from "./qdrant-rest-client.js";

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
  result = result.replace(/api-key:\s*\S+/gi, "api-key: [REDACTED]");
  return result;
}

function mapQdrantErrorBody(
  status: number,
  message: string | undefined,
): ConnectorSdkError | undefined {
  const combined = (message ?? "").toLowerCase();

  if (status === 401 || combined.includes("unauthorized")) {
    return new ConnectorSdkError(
      "UNAUTHORIZED",
      "Qdrant API key is invalid or missing.",
    );
  }
  if (status === 403 || combined.includes("forbidden")) {
    return new ConnectorSdkError("FORBIDDEN", "Qdrant denied access.");
  }
  if (status === 404 || combined.includes("not found")) {
    return new ConnectorSdkError("NOT_FOUND", "Qdrant resource was not found.");
  }
  if (status === 400 || combined.includes("invalid")) {
    return new ConnectorSdkError(
      "INVALID_INPUT",
      "Qdrant rejected the request parameters.",
    );
  }
  if (
    status === 429 ||
    combined.includes("rate limit") ||
    combined.includes("too many")
  ) {
    return rateLimitError("Qdrant rate limit exceeded.");
  }
  return undefined;
}

export interface MapQdrantErrorOptions {
  readonly apiKey?: string;
  readonly ambiguousWrite?: boolean;
}

export function mapQdrantError(
  error: unknown,
  options: MapQdrantErrorOptions = {},
): ConnectorSdkError {
  if (error instanceof ConnectorSdkError) {
    return error;
  }
  if (isAbortError(error)) {
    return new ConnectorSdkError("CANCELLED", "Qdrant request was cancelled.");
  }
  if (isTimeoutError(error)) {
    return new ConnectorSdkError("TIMEOUT", "Qdrant request timed out.");
  }

  if (
    error !== null &&
    typeof error === "object" &&
    "kind" in error &&
    (error as QdrantHttpError).kind === "http"
  ) {
    const http = error as QdrantHttpError;
    const mapped = mapQdrantErrorBody(http.status, http.qdrantMessage);
    if (mapped !== undefined) {
      return mapped;
    }
    if (http.status >= 500) {
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        redactSecrets(
          http.qdrantMessage ?? "Qdrant returned a server error.",
          options.apiKey,
        ),
      );
    }
    return new ConnectorSdkError(
      "PROVIDER_ERROR",
      redactSecrets(
        http.qdrantMessage ?? "Qdrant request failed.",
        options.apiKey,
      ),
    );
  }

  const message =
    error instanceof Error
      ? redactSecrets(error.message, options.apiKey)
      : "Qdrant request failed.";
  if (options.ambiguousWrite === true) {
    return new ConnectorSdkError(
      "PROVIDER_ERROR",
      `${message} Write outcome is ambiguous; verify state before retrying.`,
    );
  }
  return new ConnectorSdkError("PROVIDER_ERROR", message);
}
