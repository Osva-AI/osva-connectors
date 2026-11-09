import { ConnectorSdkError } from "@osva-ai/connector-sdk";

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.message.includes("aborted"))
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

export interface MapProviderErrorOptions {
  readonly accessKeyId?: string;
  readonly secretAccessKey?: string;
  readonly sessionToken?: string;
}

export function mapProviderError(
  error: unknown,
  options?: MapProviderErrorOptions,
): ConnectorSdkError {
  if (error instanceof ConnectorSdkError) {
    return error;
  }
  if (isAbortError(error)) {
    return new ConnectorSdkError("CANCELLED", "Request was cancelled.");
  }

  const secrets = [
    options?.accessKeyId,
    options?.secretAccessKey,
    options?.sessionToken,
  ].filter((v): v is string => v !== undefined && v.length > 0);

  const name =
    error !== null &&
    typeof error === "object" &&
    "name" in error &&
    typeof (error as { name: unknown }).name === "string"
      ? (error as { name: string }).name
      : undefined;

  if (name === "NotFound" || name === "NoSuchKey" || name === "NoSuchBucket") {
    return new ConnectorSdkError("NOT_FOUND", "S3 resource was not found.");
  }
  if (name === "PreconditionFailed" || name === "412") {
    return new ConnectorSdkError(
      "CONFLICT",
      "Conditional write failed (object already exists or ETag mismatch).",
    );
  }
  if (name === "AccessDenied" || name === "Forbidden") {
    return new ConnectorSdkError("FORBIDDEN", "S3 access was denied.");
  }

  const message =
    error instanceof Error
      ? redact(error.message, secrets)
      : "Unexpected S3 provider error.";
  return new ConnectorSdkError("PROVIDER_ERROR", message, { retryable: true });
}
