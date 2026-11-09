import { ConnectorSdkError } from "@osva-ai/connector-sdk";

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.message.includes("aborted"))
  );
}

function isTimeoutError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "TimeoutError" || error.message.includes("timed out"))
  );
}

function redact(text: string, secrets: readonly string[]): string {
  let out = text;
  for (const secret of secrets) {
    if (secret.length < 4) {
      continue;
    }
    out = out.split(secret).join("[REDACTED]");
  }
  return out;
}

export interface MapSnowflakeErrorOptions {
  readonly password?: string;
}

export function mapSnowflakeError(
  error: unknown,
  options?: MapSnowflakeErrorOptions,
): ConnectorSdkError {
  if (error instanceof ConnectorSdkError) {
    return error;
  }
  if (isAbortError(error)) {
    return new ConnectorSdkError("CANCELLED", "Request was cancelled.");
  }
  if (isTimeoutError(error)) {
    return new ConnectorSdkError(
      "TIMEOUT",
      "Snowflake query exceeded the configured timeout.",
    );
  }

  const secrets = [options?.password].filter(
    (v): v is string => v !== undefined && v.length > 0,
  );

  const code =
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
      ? (error as { code: string }).code
      : undefined;

  if (code === "100132" || code === "02000") {
    return new ConnectorSdkError(
      "NOT_FOUND",
      "Snowflake resource was not found.",
    );
  }
  if (code === "390100" || code === "390114") {
    return new ConnectorSdkError("FORBIDDEN", "Snowflake access was denied.");
  }

  const message =
    error instanceof Error
      ? redact(error.message, secrets)
      : "Unexpected Snowflake provider error.";
  return new ConnectorSdkError("PROVIDER_ERROR", message, { retryable: true });
}
