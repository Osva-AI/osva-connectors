import { RequestError } from "@octokit/request-error";
import { ConnectorSdkError, rateLimitError } from "@osva-ai/connector-sdk";

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }
  if (error instanceof Error && error.name === "AbortError") {
    return true;
  }
  return false;
}

function readHeader(
  headers: Record<string, unknown> | undefined,
  name: string,
): string | undefined {
  if (headers === undefined) {
    return undefined;
  }
  const direct = headers[name];
  if (typeof direct === "string") {
    return direct;
  }
  const lower = headers[name.toLowerCase()];
  if (typeof lower === "string") {
    return lower;
  }
  return undefined;
}

function isGithubRateLimitResponse(error: RequestError): boolean {
  const headers = error.response?.headers as
    Record<string, unknown> | undefined;
  const remaining = readHeader(headers, "x-ratelimit-remaining");
  if (remaining === "0") {
    return true;
  }
  const retryAfter = readHeader(headers, "retry-after");
  return retryAfter !== undefined && retryAfter.length > 0;
}

function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const code = (error as Error & { code?: string }).code;
  return (
    error.name === "TimeoutError" ||
    code === "ETIMEDOUT" ||
    code === "ESOCKETTIMEDOUT"
  );
}

export function mapGithubError(error: unknown): ConnectorSdkError {
  if (error instanceof ConnectorSdkError) {
    return error;
  }

  if (isAbortError(error)) {
    return new ConnectorSdkError("CANCELLED", "Request was cancelled.");
  }

  if (isTimeoutError(error)) {
    return new ConnectorSdkError("TIMEOUT", "GitHub request timed out.", {
      retryable: true,
    });
  }

  if (error instanceof RequestError) {
    const status = error.status;
    if (status === 401) {
      return new ConnectorSdkError(
        "UNAUTHORIZED",
        "GitHub authentication failed.",
      );
    }
    if (status === 403) {
      if (isGithubRateLimitResponse(error)) {
        return rateLimitError("GitHub rate limit exceeded.");
      }
      return new ConnectorSdkError(
        "FORBIDDEN",
        "GitHub denied access to this repository.",
      );
    }
    if (status === 404) {
      return new ConnectorSdkError("NOT_FOUND", "Repository not found.");
    }
    if (status === 429) {
      return rateLimitError("GitHub rate limit exceeded.");
    }
  }

  return new ConnectorSdkError(
    "PROVIDER_ERROR",
    "An unexpected error occurred while contacting GitHub.",
  );
}
