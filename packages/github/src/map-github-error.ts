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

export interface MapGithubErrorOptions {
  /** When true, avoid implying a failed response means a write did not occur. */
  readonly ambiguousWrite?: boolean;
}

const AMBIGUOUS_WRITE_MESSAGE =
  "GitHub did not return a confirmable response. The change may still have been applied; verify on GitHub before retrying.";

export function mapGithubError(
  error: unknown,
  options?: MapGithubErrorOptions,
): ConnectorSdkError {
  const ambiguousWrite = options?.ambiguousWrite === true;
  if (error instanceof ConnectorSdkError) {
    return error;
  }

  if (isAbortError(error)) {
    return new ConnectorSdkError("CANCELLED", "Request was cancelled.");
  }

  if (isTimeoutError(error)) {
    if (ambiguousWrite) {
      return new ConnectorSdkError("TIMEOUT", AMBIGUOUS_WRITE_MESSAGE, {
        retryable: false,
      });
    }
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
        if (ambiguousWrite) {
          return new ConnectorSdkError(
            "RATE_LIMITED",
            AMBIGUOUS_WRITE_MESSAGE,
            {
              retryable: false,
            },
          );
        }
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
    if (status === 422) {
      return new ConnectorSdkError(
        "INVALID_INPUT",
        "GitHub rejected the request payload.",
      );
    }
    if (status === 429) {
      if (ambiguousWrite) {
        return new ConnectorSdkError("RATE_LIMITED", AMBIGUOUS_WRITE_MESSAGE, {
          retryable: false,
        });
      }
      return rateLimitError("GitHub rate limit exceeded.");
    }
    if (ambiguousWrite && status >= 500) {
      return new ConnectorSdkError("PROVIDER_ERROR", AMBIGUOUS_WRITE_MESSAGE, {
        retryable: false,
      });
    }
  }

  if (ambiguousWrite) {
    return new ConnectorSdkError("PROVIDER_ERROR", AMBIGUOUS_WRITE_MESSAGE, {
      retryable: false,
    });
  }

  return new ConnectorSdkError(
    "PROVIDER_ERROR",
    "An unexpected error occurred while contacting GitHub.",
  );
}
