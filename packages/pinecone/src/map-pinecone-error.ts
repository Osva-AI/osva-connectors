import { ConnectorSdkError, rateLimitError } from "@osva-ai/connector-sdk";

import type { PineconeHttpError } from "./pinecone-rest-client.js";

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
  result = result.replace(/api-key:\s*\S+/gi, "Api-Key: [REDACTED]");
  return result;
}

function mapPineconeErrorBody(
  status: number,
  message: string | undefined,
): ConnectorSdkError | undefined {
  const combined = (message ?? "").toLowerCase();

  if (status === 401 || combined.includes("unauthorized")) {
    return new ConnectorSdkError(
      "UNAUTHORIZED",
      "Pinecone API key is invalid or missing.",
    );
  }
  if (status === 403 || combined.includes("forbidden")) {
    return new ConnectorSdkError("FORBIDDEN", "Pinecone denied access.");
  }
  if (status === 404 || combined.includes("not found")) {
    return new ConnectorSdkError(
      "NOT_FOUND",
      "Pinecone resource was not found.",
    );
  }
  if (status === 400 || combined.includes("invalid")) {
    return new ConnectorSdkError(
      "INVALID_INPUT",
      "Pinecone rejected the request parameters.",
    );
  }
  if (
    status === 429 ||
    combined.includes("rate limit") ||
    combined.includes("too many")
  ) {
    return rateLimitError("Pinecone rate limit exceeded.");
  }
  return undefined;
}

export interface MapPineconeErrorOptions {
  readonly apiKey?: string;
  readonly ambiguousWrite?: boolean;
}

export function mapPineconeError(
  error: unknown,
  options: MapPineconeErrorOptions = {},
): ConnectorSdkError {
  if (error instanceof ConnectorSdkError) {
    return error;
  }
  if (isAbortError(error)) {
    return new ConnectorSdkError(
      "CANCELLED",
      "Pinecone request was cancelled.",
    );
  }
  if (isTimeoutError(error)) {
    return new ConnectorSdkError("TIMEOUT", "Pinecone request timed out.");
  }

  if (
    error !== null &&
    typeof error === "object" &&
    "kind" in error &&
    (error as PineconeHttpError).kind === "http"
  ) {
    const http = error as PineconeHttpError;
    const mapped = mapPineconeErrorBody(http.status, http.pineconeMessage);
    if (mapped !== undefined) {
      return mapped;
    }
    if (http.status >= 500) {
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        redactSecrets(
          http.pineconeMessage ?? "Pinecone returned a server error.",
          options.apiKey,
        ),
      );
    }
    return new ConnectorSdkError(
      "PROVIDER_ERROR",
      redactSecrets(
        http.pineconeMessage ?? "Pinecone request failed.",
        options.apiKey,
      ),
    );
  }

  const message =
    error instanceof Error
      ? redactSecrets(error.message, options.apiKey)
      : "Pinecone request failed.";
  if (options.ambiguousWrite === true) {
    return new ConnectorSdkError(
      "PROVIDER_ERROR",
      `${message} Write outcome is ambiguous; verify state before retrying.`,
    );
  }
  return new ConnectorSdkError("PROVIDER_ERROR", message);
}
