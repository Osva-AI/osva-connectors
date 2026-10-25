import { ConnectorSdkError, rateLimitError } from "@osva-ai/connector-sdk";

import type { SlackHttpError } from "./slack-rest-client.js";

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

function redactSecrets(message: string, botToken?: string): string {
  let result = message;
  if (botToken !== undefined && botToken.length > 0) {
    result = result.split(botToken).join("[REDACTED]");
  }
  result = result.replace(/xox[baprs]-[a-zA-Z0-9-]+/g, "[REDACTED]");
  result = result.replace(
    /Authorization:\s*Bearer\s+\S+/gi,
    "Authorization: Bearer [REDACTED]",
  );
  return result;
}

export interface MapSlackErrorOptions {
  readonly botToken?: string;
  /** When true, avoid implying a failed response means a write did not occur. */
  readonly ambiguousWrite?: boolean;
}

const AMBIGUOUS_WRITE_MESSAGE =
  "Slack did not return a confirmable response. The message may still have been posted; verify in Slack before retrying.";

function mapSlackApiErrorCode(
  code: string | undefined,
  ambiguousWrite: boolean,
): ConnectorSdkError | undefined {
  const normalized = (code ?? "").toLowerCase();
  if (normalized === "invalid_auth" || normalized === "token_revoked") {
    return new ConnectorSdkError(
      "UNAUTHORIZED",
      "Slack authentication failed.",
    );
  }
  if (normalized === "missing_scope" || normalized === "not_authed") {
    return new ConnectorSdkError(
      "FORBIDDEN",
      "Slack denied access due to missing scopes or auth.",
    );
  }
  if (normalized === "not_in_channel") {
    return new ConnectorSdkError(
      "FORBIDDEN",
      "The bot is not a member of this channel.",
    );
  }
  if (normalized === "channel_not_found") {
    return new ConnectorSdkError("NOT_FOUND", "Slack channel was not found.");
  }
  if (normalized === "ratelimited") {
    if (ambiguousWrite) {
      return new ConnectorSdkError("RATE_LIMITED", AMBIGUOUS_WRITE_MESSAGE, {
        retryable: false,
      });
    }
    return rateLimitError("Slack rate limit exceeded.");
  }
  if (normalized === "msg_too_long" || normalized === "invalid_arguments") {
    return new ConnectorSdkError(
      "INVALID_INPUT",
      "Slack rejected the message payload.",
    );
  }
  return undefined;
}

export function mapSlackError(
  error: unknown,
  options?: MapSlackErrorOptions,
): ConnectorSdkError {
  const botToken = options?.botToken;
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
    return new ConnectorSdkError("TIMEOUT", "Slack request timed out.", {
      retryable: true,
    });
  }

  if (
    error !== null &&
    typeof error === "object" &&
    "kind" in error &&
    (error as SlackHttpError).kind === "slack_api"
  ) {
    const apiError = error as SlackHttpError & { kind: "slack_api" };
    const mapped = mapSlackApiErrorCode(apiError.slackError, ambiguousWrite);
    if (mapped !== undefined) {
      return mapped;
    }
    if (ambiguousWrite) {
      return new ConnectorSdkError("PROVIDER_ERROR", AMBIGUOUS_WRITE_MESSAGE, {
        retryable: false,
      });
    }
    return new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Slack rejected the API request.",
    );
  }

  if (
    error !== null &&
    typeof error === "object" &&
    "kind" in error &&
    (error as SlackHttpError).kind === "http"
  ) {
    const httpError = error as SlackHttpError & { kind: "http" };
    if (httpError.status === 401) {
      return new ConnectorSdkError(
        "UNAUTHORIZED",
        "Slack authentication failed.",
      );
    }
    if (httpError.status === 403) {
      return new ConnectorSdkError(
        "FORBIDDEN",
        "Slack denied access to this resource.",
      );
    }
    if (httpError.status === 404) {
      return new ConnectorSdkError(
        "NOT_FOUND",
        "Slack resource was not found.",
      );
    }
    if (httpError.status === 429) {
      if (ambiguousWrite) {
        return new ConnectorSdkError("RATE_LIMITED", AMBIGUOUS_WRITE_MESSAGE, {
          retryable: false,
        });
      }
      return rateLimitError("Slack rate limit exceeded.");
    }
    if (httpError.status !== undefined && httpError.status >= 500) {
      if (ambiguousWrite) {
        return new ConnectorSdkError(
          "PROVIDER_ERROR",
          AMBIGUOUS_WRITE_MESSAGE,
          {
            retryable: false,
          },
        );
      }
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Slack is temporarily unavailable.",
        { retryable: true },
      );
    }
  }

  if (ambiguousWrite) {
    return new ConnectorSdkError("PROVIDER_ERROR", AMBIGUOUS_WRITE_MESSAGE, {
      retryable: false,
    });
  }

  if (error instanceof Error) {
    const sanitized = redactSecrets(error.message, botToken);
    if (sanitized.includes("[REDACTED]") && sanitized.length > 80) {
      return new ConnectorSdkError(
        "PROVIDER_ERROR",
        "An unexpected error occurred while contacting Slack.",
      );
    }
  }

  return new ConnectorSdkError(
    "PROVIDER_ERROR",
    "An unexpected error occurred while contacting Slack.",
  );
}
